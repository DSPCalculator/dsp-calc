const http = require('http');
const {spawnSync} = require('child_process');

const DEFAULT_DEV_PORT = 5173;
const CALCULATOR_TITLE = '戴森球计划量化计算器';
const HTTP_TIMEOUT_MS = 1000;
const KILL_WAIT_MS = 3000;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function extractTitle(html) {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function isCalculatorPage(html) {
    return extractTitle(html) === CALCULATOR_TITLE;
}

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.error || result.status !== 0) {
        return '';
    }

    return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function uniquePids(pids) {
    return [...new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0))];
}

function parsePlainPidLines(output) {
    return uniquePids(output
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter((value) => /^\d+$/.test(value))
        .map((value) => Number.parseInt(value, 10))
        .filter(Number.isInteger));
}

function parseFuserPids(output, port) {
    const pids = [];
    for (const line of output.split(/\r?\n/)) {
        const markerIndex = line.indexOf(`${port}/tcp:`);
        const pidText = markerIndex >= 0
            ? line.slice(markerIndex + `${port}/tcp:`.length)
            : line;
        for (const value of pidText.trim().split(/\s+/)) {
            if (/^\d+$/.test(value)) {
                pids.push(Number.parseInt(value, 10));
            }
        }
    }

    return uniquePids(pids);
}

function localAddressUsesPort(localAddress, port) {
    return localAddress.endsWith(`:${port}`);
}

function parseSsPids(output, port) {
    const pids = [];
    for (const line of output.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        if (!parts.some((part) => localAddressUsesPort(part, port))) {
            continue;
        }

        const matches = line.matchAll(/pid=(\d+)/g);
        for (const match of matches) {
            pids.push(Number.parseInt(match[1], 10));
        }
    }

    return uniquePids(pids);
}

function parseWindowsNetstatPids(output, port) {
    const pids = [];
    for (const line of output.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5 || parts[0].toUpperCase() !== 'TCP') {
            continue;
        }

        const localAddress = parts[1];
        const state = parts[3]?.toUpperCase();
        const pid = Number.parseInt(parts[4], 10);
        if (state === 'LISTENING' && localAddressUsesPort(localAddress, port)) {
            pids.push(pid);
        }
    }

    return uniquePids(pids);
}

function findListeningPids(port) {
    if (process.platform === 'win32') {
        return parseWindowsNetstatPids(runCommand('netstat', ['-ano', '-p', 'tcp']), port);
    }

    const lsofPids = parsePlainPidLines(runCommand('lsof', [
        '-nP',
        `-tiTCP:${port}`,
        '-sTCP:LISTEN',
    ]));
    if (lsofPids.length > 0) {
        return lsofPids;
    }

    const ssPids = parseSsPids(runCommand('ss', ['-ltnp']), port);
    if (ssPids.length > 0) {
        return ssPids;
    }

    return parseFuserPids(runCommand('fuser', ['-n', 'tcp', String(port)]), port);
}

async function probePort(port, timeoutMs = HTTP_TIMEOUT_MS) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };

        const request = http.get({
            host: '127.0.0.1',
            port,
            path: '/',
            timeout: timeoutMs,
        }, (response) => {
            response.setEncoding('utf8');
            let body = '';
            response.on('data', (chunk) => {
                body += chunk;
                if (body.length > 1024 * 1024) {
                    request.destroy(new Error('Response body is too large'));
                }
            });
            response.on('end', () => {
                finish({
                    status: 'http',
                    statusCode: response.statusCode,
                    body,
                });
            });
        });

        request.on('timeout', () => {
            request.destroy(new Error('HTTP probe timed out'));
        });

        request.on('error', (error) => {
            if (error.code === 'ECONNREFUSED') {
                finish({status: 'free'});
                return;
            }

            finish({
                status: 'unknown',
                error,
            });
        });
    });
}

function terminatePids(pids, options = {}) {
    const signal = options.force ? 'SIGKILL' : 'SIGTERM';
    for (const pid of uniquePids(pids)) {
        if (pid === process.pid) {
            continue;
        }

        if (process.platform === 'win32') {
            spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
                stdio: 'ignore',
            });
            continue;
        }

        try {
            process.kill(pid, signal);
        } catch (error) {
            if (error.code !== 'ESRCH') {
                throw error;
            }
        }
    }
}

async function waitUntilPortFree(port, timeoutMs = KILL_WAIT_MS) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const result = await probePort(port, HTTP_TIMEOUT_MS);
        if (result.status === 'free') {
            return true;
        }

        await sleep(150);
    }

    return false;
}

async function runGuard(options = {}) {
    const port = options.port ?? DEFAULT_DEV_PORT;
    const logger = options.logger ?? console;
    const probe = options.probePort ?? probePort;
    const findPids = options.findListeningPids ?? findListeningPids;
    const terminate = options.terminatePids ?? terminatePids;
    const waitFree = options.waitUntilPortFree ?? waitUntilPortFree;

    const result = await probe(port);
    if (result.status === 'free') {
        logger.log(`[dev-port-guard] ${port} is free.`);
        return {status: 'free', exitCode: 0};
    }

    if (result.status !== 'http') {
        logger.error(`[dev-port-guard] ${port} is occupied, but it is not a readable HTTP dev server.`);
        return {status: 'blocked', exitCode: 1};
    }

    if (!isCalculatorPage(result.body)) {
        logger.error(`[dev-port-guard] ${port} is occupied by another HTTP service. Refusing to kill it.`);
        return {status: 'blocked', exitCode: 1};
    }

    const pids = findPids(port);
    if (pids.length === 0) {
        logger.error(`[dev-port-guard] ${port} serves this calculator, but no listening process was found.`);
        return {status: 'blocked', exitCode: 1};
    }

    logger.warn(`[dev-port-guard] ${port} already serves this calculator. Terminating PID(s): ${pids.join(', ')}`);
    terminate(pids, {force: false});
    if (await waitFree(port)) {
        return {status: 'terminated', exitCode: 0};
    }

    logger.warn(`[dev-port-guard] ${port} is still occupied after SIGTERM. Forcing termination.`);
    terminate(pids, {force: true});
    if (await waitFree(port)) {
        return {status: 'terminated', exitCode: 0};
    }

    logger.error(`[dev-port-guard] Unable to free ${port}.`);
    return {status: 'blocked', exitCode: 1};
}

module.exports = {
    CALCULATOR_TITLE,
    DEFAULT_DEV_PORT,
    extractTitle,
    findListeningPids,
    isCalculatorPage,
    parseFuserPids,
    parseSsPids,
    parseWindowsNetstatPids,
    probePort,
    runGuard,
    terminatePids,
    waitUntilPortFree,
};

if (require.main === module) {
    runGuard()
        .then((result) => {
            process.exitCode = result.exitCode;
        })
        .catch((error) => {
            console.error('[dev-port-guard] Unexpected failure.');
            console.error(error);
            process.exitCode = 1;
        });
}
