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
    const logWatcher = watchLogsForReconcile(RESOURCE_NAME);

    console.log("Starting timer and running 'git push'...");
    const startTime = Date.now();

    try {
        await runCommand("git push");
    } catch {
        process.exit(1);
    }

    await logWatcher;

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n✅ Total deployment duration: ${duration.toFixed(2)} seconds`);
})();
