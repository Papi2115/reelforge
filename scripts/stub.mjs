// Placeholder for root scripts that are part of the CLAUDE.md §5 command contract
// but not implemented yet. Prints a notice and exits 0 so the contract stays callable.
// Usage: node scripts/stub.mjs <script-name> "<message>" [...ignored args]
import process from 'node:process';

const [scriptName = 'unknown', message = 'not implemented yet'] = process.argv.slice(2);
process.stdout.write(`[reelforge] ${scriptName}: ${message}\n`);
process.exitCode = 0;
