// Not re-exported from the package index — only from this subpath.
import { LengthFinishReasonError } from "openai/error";

// One failure mode, said in Japanese.
//
// A structured-output call that runs out of budget throws
// `LengthFinishReasonError`, whose message is "Could not parse response content
// as the length limit was reached". That sentence reached the run log verbatim
// and told a user nothing: not which limit, not why this take hit it, not what
// to do — and it reads like a bug in the tool rather than a size the work
// exceeded. Somebody who saw it reasonably guessed their video had been
// corrupted by editing while building, and asked whether starting over would
// help. It would not: the same documents produce the same wall.
//
// The budget counts REASONING as well as output on these models, so most of it
// is spent before the first character of JSON. That is why the limits here are
// far above the size of the answers they carry.

export async function parseOrExplain<T>(
  call: () => Promise<T>,
  explanation: string,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof LengthFinishReasonError) throw new Error(explanation);
    throw error;
  }
}
