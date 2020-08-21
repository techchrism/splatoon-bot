const fs = require('fs').promises;
require('dotenv').config();
const {argv} = require('yargs').option('token', {
    alias: 't',
    type: 'string',
    description: 'The Discord bot token'
}).option('prefix', {
    alias: 'p',
    type: 'string',
    description: 'The bot command prefix'
}).option('config', {
    alias: 'c',
    type: 'string',
    description: 'The path to the bot config'
});

async function writeDefaultConfig()
{
    return fs.writeFile(argv.config || 'config.json', JSON.stringify({
        token: '',
        prefix: '!',
    }, null, 4));
}

async function loadConfig(logger)
{
    let fileText = '';
    try
    {
        fileText = await fs.readFile(argv.config || 'config.json', 'utf8');
    }
    catch(e)
    {
        logger.error('Config file not found! Creating default config...');
        await writeDefaultConfig();
        return loadConfig(logger);
    }
    
    try
    {
        const data = JSON.parse(fileText);
        return {
            token: argv.token || process.env['TOKEN'] || data.token,
            prefix: argv.prefix || process.env['PREFIX'] || data.prefix
        };
    }
    catch(e)
    {
        const newName = `config-broken-${Date.now()}.json`;
        logger.error(`Could not parse config! Moved to ${newName}`);
        await fs.rename(argv.config || 'config.json', newName);
        await writeDefaultConfig();
        return loadConfig(logger);
    }
}

module.exports = loadConfig;
