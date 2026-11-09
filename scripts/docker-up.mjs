import { spawn } from "node:child_process"

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" })
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`))
    })
  })
}

await run("pnpm", ["exec", "supabase", "start"])
await run("pnpm", ["exec", "supabase", "db", "reset"])
await run("docker", ["compose", "up", "--build"])
