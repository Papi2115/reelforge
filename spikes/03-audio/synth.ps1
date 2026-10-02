# Synthesizes a clean voiceover with the built-in Windows SAPI voices (System.Speech) and records
# word-boundary (SpeakProgress) and viseme events as ground-truth-ish timings.
# Called by synth.mjs; text is read from a UTF-8 file to keep Polish diacritics intact.
param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$Voice,
  [Parameter(Mandatory = $true)][string]$OutWav,
  [Parameter(Mandatory = $true)][string]$OutEvents,
  [int]$LeadMs = 1500,
  [int]$ParagraphBreakMs = 2500,
  [int]$TailMs = 1000
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Speech.AudioFormat;
using System.Speech.Synthesis;

public static class SpikeSynth {
  static string Esc(string s) {
    var b = new StringBuilder();
    foreach (char c in s) {
      if (c == '"' || c == '\\') { b.Append('\\'); b.Append(c); }
      else if (c < 0x20) { b.Append("\\u" + ((int)c).ToString("x4")); }
      else { b.Append(c); }
    }
    return b.ToString();
  }

  public static void Run(string text, string voice, string outWav, string outEvents,
                         int leadMs, int breakMs, int tailMs) {
    var words = new List<string>();
    var visemes = new List<string>();
    using (var synth = new SpeechSynthesizer()) {
      synth.SelectVoice(voice);
      // 16 kHz = native rate of the Desktop voices. At any other rate SAPI resamples the audio
      // but reports AudioPosition scaled by (rate / 16000), i.e. wrong event timings.
      synth.SetOutputToWaveFile(outWav,
        new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
      synth.SpeakProgress += (s, e) => words.Add(string.Format(CultureInfo.InvariantCulture,
        "{{\"text\":\"{0}\",\"ms\":{1},\"charPos\":{2},\"charCount\":{3}}}",
        Esc(e.Text), e.AudioPosition.TotalMilliseconds, e.CharacterPosition, e.CharacterCount));
      synth.VisemeReached += (s, e) => visemes.Add(string.Format(CultureInfo.InvariantCulture,
        "{{\"viseme\":{0},\"ms\":{1},\"durMs\":{2}}}",
        e.Viseme, e.AudioPosition.TotalMilliseconds, e.Duration.TotalMilliseconds));
      var prompt = new PromptBuilder();
      prompt.AppendBreak(TimeSpan.FromMilliseconds(leadMs));
      var paragraphs = text.Replace("\r\n", "\n").Split(new[] { "\n\n" },
        StringSplitOptions.RemoveEmptyEntries);
      for (int i = 0; i < paragraphs.Length; i++) {
        if (i > 0) prompt.AppendBreak(TimeSpan.FromMilliseconds(breakMs));
        prompt.AppendText(paragraphs[i].Trim());
      }
      prompt.AppendBreak(TimeSpan.FromMilliseconds(tailMs));
      synth.Speak(prompt);
      synth.SetOutputToNull();
    }
    var json = "{\"voice\":\"" + Esc(voice) + "\",\"words\":[" + string.Join(",", words) +
      "],\"visemes\":[" + string.Join(",", visemes) + "]}";
    File.WriteAllText(outEvents, json, new UTF8Encoding(false));
  }
}
'@
$text = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8)
[SpikeSynth]::Run($text, $Voice, $OutWav, $OutEvents, $LeadMs, $ParagraphBreakMs, $TailMs)
