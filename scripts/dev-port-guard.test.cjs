const assert = require('assert');

const {
    extractTitle,
    isCalculatorPage,
    parseFuserPids,
    parseSsPids,
    parseWindowsNetstatPids,
    runGuard,
} = require('./dev-port-guard.cjs');

async function test(name, fn) {
    try {
        await fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

test('extracts the calculator title from index html', () => {
    const title = extractTitle('<html><head><title>戴森球计划量化计算器</title></head></html>');
    assert.strictEqual(title, '戴森球计划量化计算器');
    assert.strictEqual(isCalculatorPage('<title>戴森球计划量化计算器</title>'), true);
});

test('parses Linux ss listener pids for the exact dev port', () => {
    const output = [
        'LISTEN 0 511 0.0.0.0:5173 0.0.0.0:* users:(("node",pid=4321,fd=20))',
        'LISTEN 0 511 0.0.0.0:51730 0.0.0.0:* users:(("node",pid=9999,fd=20))',
    ].join('\n');

    assert.deepStrictEqual(parseSsPids(output, 5173), [4321]);
});

test('parses Linux fuser listener pids without treating the port as a pid', () => {
    assert.deepStrictEqual(parseFuserPids('5173/tcp:             2468 3579\n', 5173), [2468, 3579]);
});

test('parses Windows netstat listener pids for the exact dev port', () => {
    const output = [
        '  TCP    0.0.0.0:5173      0.0.0.0:0      LISTENING       1234',
        '  TCP    [::]:5173         [::]:0         LISTENING       1235',
        '  TCP    127.0.0.1:51730   0.0.0.0:0      LISTENING       9999',
    ].join('\n');

    assert.deepStrictEqual(parseWindowsNetstatPids(output, 5173), [1234, 1235]);
});

test('terminates an existing calculator instance on the dev port', async () => {
    const calls = [];
    const result = await runGuard({
        port: 5173,
        probePort: async () => ({
            status: 'http',
            body: '<title>戴森球计划量化计算器</title>',
        }),
        findListeningPids: () => [2468],
        terminatePids: (pids) => {
            calls.push(['terminate', pids]);
        },
        waitUntilPortFree: async () => true,
        logger: {log() {}, warn() {}, error() {}},
    });

    assert.strictEqual(result.status, 'terminated');
    assert.deepStrictEqual(calls, [['terminate', [2468]]]);
});

test('blocks startup when the dev port belongs to another service', async () => {
    const calls = [];
    const result = await runGuard({
        port: 5173,
        probePort: async () => ({
            status: 'http',
            body: '<title>Other App</title>',
        }),
        findListeningPids: () => [1357],
        terminatePids: (pids) => {
            calls.push(['terminate', pids]);
        },
        waitUntilPortFree: async () => true,
        logger: {log() {}, warn() {}, error() {}},
    });

    assert.strictEqual(result.status, 'blocked');
    assert.strictEqual(result.exitCode, 1);
    assert.deepStrictEqual(calls, []);
});
