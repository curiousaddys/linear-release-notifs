import * as core from "@actions/core";
import * as github from "@actions/github";

async function main() {
  if (github.context.eventName !== "push") {
    core.setFailed("This action can only be used on push events.");
    return;
  }
  console.log("commits:", github.context.payload.commits);
}

main().catch((e) => core.setFailed(e));
