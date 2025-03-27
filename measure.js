const { exec } = require("child_process");

const RESOURCE_NAME = "auction_explore";
const POLL_INTERVAL = 1000; // ms

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

async function getResourceStatus() {
    try {
        const output = await runCommand("rill project status");
        const lines = output.split("\n");
        for (const line of lines) {
            if (line.includes(RESOURCE_NAME)) {
                const match = line.trim().split(/\s+/); // split by whitespace
                if (match.length >= 2) {
                    return match[1]; // STATUS is second column
                }
            }
        }
    } catch (err) {
        console.error("Error getting resource status:", err.message);
    }
    return null;
}

async function waitForStatusChangeFromIdle() {
    console.log(`Waiting for '${RESOURCE_NAME}' to change from Idle...`);
    while (true) {
        const status = await getResourceStatus();
        if (status && status !== "Idle") {
            console.log(`Status changed to: ${status}`);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
}

async function waitUntilBackToIdle() {
    console.log("Waiting for status to return to Idle...");
    while (true) {
        const status = await getResourceStatus();
        if (status === "Idle") {
            console.log("Status is back to Idle.");
            return;
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
}

(async function main() {
    console.log("Starting timer and running 'git push'...");
    const startTime = Date.now();

    try {
        await runCommand("git push");
    } catch {
        process.exit(1);
    }

    await waitForStatusChangeFromIdle();
    await waitUntilBackToIdle();

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n✅ Total deployment duration: ${duration.toFixed(2)} seconds`);
})();
