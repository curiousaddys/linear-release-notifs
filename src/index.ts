import * as core from "@actions/core"
import * as github from "@actions/github"
import { LinearClient } from "@linear/sdk"
import got from "got"
import { z } from "zod"
import { CommitSchema } from "./types"

const MAX_ISSUE_TITLE_LENGTH = 50

function getIssueIds(commits: CommitSchema[]) {
  return commits.flatMap((c) => c.message.match(/([A-Z]+-\d+)/g) ?? [])
}

function validateContextAndGetCommits() {
  if (github.context.eventName !== "push") {
    throw "This action can only be used on push events."
  }

  const commitsParsed = z
    .array(CommitSchema)
    .safeParse(github.context.payload.commits)
  if (!commitsParsed.success) {
    throw commitsParsed.error
  }

  return commitsParsed.data
}

function truncateTo(input: string, length: number) {
  return input.length > length ? `${input.slice(0, length - 1)}…` : input
}

async function main() {
  const webhookUrl = core.getInput("discord-webhook-url", { required: true })
  const linear = new LinearClient({
    apiKey: core.getInput("linear-api-key", { required: true }),
  })

  const commits = validateContextAndGetCommits()
  const issueIds = getIssueIds(commits)

  const issues = (
    await Promise.all(
      issueIds.map(async (issueId) => {
        const issue = await linear.issue(issueId)
        if (!issue) {
          console.warn(`Unknown issue ID: ${issueId}`)
          return []
        }
        return issue
      })
    )
  ).flat()

  if (issues.length === 0) {
    console.log("No tickets found in commit messages. Skipping webhook.")
    return
  }

  for (const issue of issues) {
    const team = await issue.team
    if (!team) {
      console.warn(`Failed to find team for issue: ${issue.id}`)
      continue
    }
    const {
      nodes: [doneState],
    } = await team.states({
      filter: {
        name: { eqIgnoreCase: "Done" },
      },
    })
    if (!doneState) {
      console.warn(`Failed to find done state for team: ${team.name}`)
      continue
    }
    await issue.update({
      stateId: doneState.id,
    })
  }

  const ticketSummaries = await Promise.all(
    issues.map(async (issue) => {
      const [assignee, labels] = await Promise.all([
        issue.assignee,
        issue.labels(),
      ])
      return {
        title: `${issue.identifier}: ${truncateTo(
          issue.title,
          MAX_ISSUE_TITLE_LENGTH
        )}`,
        url: issue.url,
        assignee: assignee?.name,
        labels: labels.nodes.map((label) => label.name),
      }
    })
  )

  await got.post(webhookUrl, {
    json: {
      embeds: [
        {
          title: `Update released in ${github.context.repo.owner}/${github.context.repo.repo}`,
          fields: ticketSummaries.map((it) => {
            const values = [`[View](${it.url})`]
            if (it.assignee) {
              values.push(it.assignee)
            }
            if (it.labels.length) {
              values.push(it.labels.join(", "))
            }
            return {
              name: it.title,
              value: values.join(" • "),
            }
          }),
          color: 6451704,
        },
      ],
    },
  })
}

main().catch((e) => core.setFailed(e))
