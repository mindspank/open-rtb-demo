const { spawn, exec } = require("child_process");
const readline = require("readline");

const RESOURCE_NAME = "auction_explore";

function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 1000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Command failed: ${cmd}\n${stderr}`);
                return reject(error);
            }
            resolve(stdout);
        });
    });
}

async function watchLogsForReconcile(resourceName) {
    return new Promise((resolve, reject) => {
        const logProcess = spawn("rill", ["project", "logs", "--follow", "--level=debug"]);

        const rl = readline.createInterface({
            input: logProcess.stdout,
            crlfDelay: Infinity,
        });

        logProcess.stderr.on("data", data => {
            console.error(`stderr: ${data}`);
        });

        logProcess.on("error", err => {
            reject(new Error(`Failed to start log process: ${err.message}`));
        });

        rl.on("line", line => {
            if (
                line.includes("INFO") &&
                line.includes("Reconciled resource") &&
                line.includes(`"name":"${resourceName}"`)
            ) {
                console.log(`✅ Found reconcile log for ${resourceName}`);
                rl.close();
                logProcess.kill();
                resolve();
            }
        });
    });
}

(async function main() {
    console.log("Starting log watcher...");
    const totalStart = Date.now();
    const logWatcher = watchLogsForReconcile(RESOURCE_NAME);

    console.log("Running 'git push'...");
    const gitStart = Date.now();
    try {
        await runCommand("git push");
    } catch {
        process.exit(1);
    }
    const gitEnd = Date.now();
    const gitDuration = (gitEnd - gitStart) / 1000;

    console.log(`git push completed in ${gitDuration.toFixed(2)} seconds`);

    await logWatcher;

    const totalEnd = Date.now();
    const totalDuration = (totalEnd - totalStart) / 1000;

    console.log(`\n✅ Total deployment duration: ${totalDuration.toFixed(2)} seconds`);
    console.log(`📦 Git push duration: ${gitDuration.toFixed(2)} seconds`);
    console.log(`⚙️  Post-push (reconciliation) duration: ${(totalDuration - gitDuration).toFixed(2)} seconds`);
})();
