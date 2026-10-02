/** Output of the engine CLIs (no console in library code; the entry wires process streams). */
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export const processIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};
