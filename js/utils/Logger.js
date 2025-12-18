
export const Logger = {
    async log(category, message, data = null) {
        const timestamp = new Date().toISOString();
        let logLine = `[${timestamp}] [${category.toUpperCase()}] ${message}`;

        if (data) {
            try {
                const json = JSON.stringify(data);
                logLine += ` | DATA: ${json}`;
            } catch (e) {
                logLine += ` | DATA: [Circular/Error]`;
            }
        }

        // Console output for devtools
        console.log(`%c[${category}]`, 'color: #00ffff', message, data || '');

        // File output via Electron IPC
        if (window.api) {
            try {
                await window.api.invoke('append-log', logLine);
            } catch (e) {
                console.error('Failed to write log:', e);
            }
        }
    },

    info(msg, data) { this.log('INFO', msg, data); },
    error(msg, data) { this.log('ERROR', msg, data); },
    action(msg, data) { this.log('ACTION', msg, data); },
    debug(msg, data) { this.log('DEBUG', msg, data); }
};
