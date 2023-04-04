import * as core from "@actions/core";
import * as github from "@actions/github";
import { z } from "zod";
import { CommitSchema } from "./types";

async function main() {
  if (github.context.eventName !== "push") {
    core.setFailed("This action can only be used on push events.");
    return;
  }
  const commitsParsed = z
    .array(CommitSchema)
    .safeParse(github.context.payload.commits);
  if (!commitsParsed.success) {
    core.setFailed(commitsParsed.error);
    return;
  }
  const commits = commitsParsed.data;
  console.log(
    commits.map((c) => `[${c.id}] ${c.author.username} - ${c.message}`)
  );
}

main().catch((e) => core.setFailed(e));
