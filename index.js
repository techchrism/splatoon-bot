const fs = require('fs');
const Discord = require('discord.js');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const WeaponsLibrary = require('./src/WeaponsLibrary');
const MapsLibrary = require('./src/MapsLibrary');
const StagesLibrary = require('./src/StagesLibrary');
const SalmonRunLibrary = require('./src/SalmonRunLibrary');
const {createLogger, format, transports} = require('winston');
const {combine, timestamp, label, prettyPrint, printf} = format;
const config = require('./config.json');
require('winston-daily-rotate-file');

// Begin logging
const fileTransport = new (transports.DailyRotateFile)({
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    dirname: 'logs'
});
const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});
const logger = createLogger({
    format: combine(
        timestamp(),
        myFormat
    ),
    transports: [
        new transports.Console(),
        fileTransport
    ]
});

logger.info('Started logging');

const adapter = new FileSync('db.json');
const db = low(adapter);
const weaponsLibrary = new WeaponsLibrary(db, logger);
const stagesLibrary = new StagesLibrary(db, logger);
const mapsLibrary = new MapsLibrary(logger);
const salmonRunLibrary = new SalmonRunLibrary(logger);

let client = new Discord.Client();

const stageKeys = {
    reg: 'stages',
    regular: 'stages',
    splat: 'stages_splatfest',
    splatfest: 'stages_splatfest',
    salmon: 'stages_salmonrun',
    salmonrun: 'stages_salmonrun',
    station: 'stages_station'
};

function sendToAllServers(data)
{
    let mapChannels = db.get('mapChannels').value();
    for(let ch of mapChannels)
    {
        client.channels.fetch(ch).then(channel =>
        {
            // Make sure it's a text-based channel (instead of a voice or category)
            if(['text', 'dm', 'group'].indexOf(channel.type) !== -1)
            {
                for(let msg of data)
                {
                    channel.send(msg).catch(logger.error);
                }
            }
        }).catch(err =>
        {
            logger.error('Error when sending to channel ' + ch);
            logger.error(err);
            db.get('mapChannels').pull(ch).write();
        })
    }
}

function weaponsToString(weapons)
{
    return weapons.map(value =>
    {
        if(value.hasOwnProperty('weapon'))
        {
            return value['weapon']['name'];
        }
        else if(value.hasOwnProperty('coop_special_weapon'))
        {
            if(value['coop_special_weapon']['name'] === 'Random')
            {
                return '**Random**';
            }
            return value['coop_special_weapon']['name'];
        }
        else
        {
            logger.warn(`Unknown weapon data: ${JSON.stringify(value)}`);
            return 'Unknown';
        }
    }).join(', ');
}

function sendSalmonRunData(data)
{
    logger.info('Sending salmon run data');

    let now = data['details'][0];
    const future = data['details'][1];
    let embed = new Discord.MessageEmbed()
        .setTitle('__Salmon Run Schedules__')
        .setThumbnail('https://i.imgur.com/Zq1HaCO.png')
        .setColor('F57A37')
        .addField('Current Stage', now['stage']['name'], true)
        .addField('Current Weapons', weaponsToString(now['weapons']), true)
        .addField('Current Shift Ends In', salmonRunLibrary.getCurrentEndString(), true)
        .addField('Future Stage', future['stage']['name'], true)
        .addField('Future Weapons', weaponsToString(future['weapons']), true)
        .addField('Future Shift Starts In', salmonRunLibrary.getFutureStartString(), true)
    sendToAllServers([embed]);
}

function sendMapData(data)
{
    logger.info('Sending map data');
    let send = [];

    // Define the data we want to display
    let scrapeInfo = [
        {
            title: '__League Maps__',
            key: 'league',
            show_game_mode: true,
            thumbnail: 'https://i.imgur.com/vfuKzvd.png',
            color: 'AD1457'
        },
        {
            title: '__Ranked Maps__',
            key: 'gachi',
            show_game_mode: true,
            thumbnail: 'https://i.imgur.com/4HTWCCO.png',
            color: 'D84315'
        },
        {
            title: '__Turf War Maps__',
            key: 'regular',
            show_game_mode: false,
            thumbnail: 'https://i.imgur.com/LHe5cLE.png',
            color: 'CDDC39'
        }
    ];

    // Loop over the data we want to display
    for(let scrape of scrapeInfo)
    {
        let embed = new Discord.MessageEmbed()
            .setTitle(scrape.title)
            .setThumbnail(scrape.thumbnail)
            .setColor(scrape.color);

        // Add current data
        let now = data[scrape.key][0];
        if(scrape.show_game_mode)
        {
            embed.addField('Current Game Mode', now['rule']['name'], true);
        }
        embed.addField('Current Maps', now['stage_a']['name'] + "\n" + now['stage_b']['name'], true);
        if(!scrape.show_game_mode)
        {
            embed.addField("\u200C", "\u200C", true);
        }

        // Add blank space
        embed.addField("\u200C", "\u200C");

        // Add next data
        let next = data[scrape.key][1];
        if(scrape.show_game_mode)
        {
            embed.addField('Next Game Mode', next['rule']['name'], true);
        }
        embed.addField('Next Maps', next['stage_a']['name'] + "\n" + next['stage_b']['name'], true);
        if(!scrape.show_game_mode)
        {
            embed.addField("\u200C", "\u200C", true);
        }

        send.push(embed);
    }

    // Add a message for the time until refresh
    let timeUntil = mapsLibrary.getRefreshInSimple();
    let timeText = timeUntil.hours + ' Hour' + (timeUntil.hours > 1 ? 's' : '');
    if(timeUntil.minutes !== 0)
    {
        timeText += ', ' + timeUntil.minutes + ' Minute' + (timeUntil.minutes > 1 ? 's' : '');
    }
    let embed = new Discord.MessageEmbed()
        .setTitle('Refresh in ' + timeText);
    send.push(embed);

    // Send this data to all servers with the update toggled
    sendToAllServers(send);
}

db.defaults({
    mapChannels: []
}).write();

// Calls when logged into discord
client.on('ready', () =>
{
    logger.info(`Logged in as "${client.user.tag}"`);

    // Start the timer to send the messages
    mapsLibrary.on('data', data =>
    {
        logger.info('Got map data');
        sendMapData(data);
    });
    mapsLibrary.load();

    salmonRunLibrary.on('data', data =>
    {
        logger.info('Got salmon run data');
        sendSalmonRunData(data);
    });
    salmonRunLibrary.load();
});

client.on('message', message =>
{
    if(message.content === `${config.prefix}weapons`)
    {
        // Send a list of weapons
        logger.info(`Sending weapons to ${message.member.user.username} in ${message.guild.name} - ${message.channel.name}`);
        weaponsLibrary.getWeapons((err, data) =>
        {
            let page = 1;
            for(let weapons of data.cachedWeaponsList)
            {
                let weaponsEmbed = new Discord.MessageEmbed()
                .setColor(5504768)
                 .setTitle(`All Splatoon 2 Weapons (Page ${page})`)
                 .setDescription(weapons);
                message.channel.send(weaponsEmbed).catch(logger.error);
                page++;
            }
        });
    }

    if(message.content === `${config.prefix}stages`)
    {
        // Send a list of stages
        logger.info(`Sending stages to ${message.member.user.username} in ${message.guild.name} - ${message.channel.name}`);
        stagesLibrary.getStages((err, data) =>
        {
            let stagesEmbed = new Discord.MessageEmbed()
                .setTitle('All Splatoon 2 Stages:')
                .setColor(5504768);

            let scrapeData = [
                {
                    name: 'Regular Stages',
                    key: 'stages'
                },
                {
                    name: 'Salmon Run Stages',
                    key: 'stages_salmonrun'
                },
                {
                    name: 'Splatfest Stages',
                    key: 'stages_splatfest'
                },
                {
                    name: 'Station Stages',
                    key: 'stages_station'
                }
            ];

            // Format the data by category (defined in scrapeData)
            for(let scrape of scrapeData)
            {
                stagesEmbed.addField(scrape.name, data[scrape.key].map(stage => stage.name).join(', '));
            }

            message.channel.send(stagesEmbed).catch(logger.error);
        });
    }

    if(message.content.startsWith(`${config.prefix}randomstage`))
    {
        logger.info(`Sending random stage to ${message.member.user.username} in ${message.guild.name} - ${message.channel.name}`);
        // Get a random stage
        let key = 'stages';
        if(message.content.length > 13)
        {
            let arg = message.content.substring(13);
            key = stageKeys.hasOwnProperty(arg) ? stageKeys[arg] : null;
        }

        if(key == null)
        {
            message.reply('Invalid category. Options are: reg, regular, splat, splatfest, salmon, salmonrun, and station');
            return;
        }
        else
        {
            stagesLibrary.getStages((err, data) =>
            {
                let maps = data[key];

                let randomMap = maps[Math.floor(Math.random() * maps.length)];
                message.reply(`Your stage is **${randomMap['name']}**`);
            });
        }
    }

    if(message.content === `${config.prefix}randomweapon`)
    {
        logger.info(`Sending random weapon to ${message.member.user.username} in ${message.guild.name} - ${message.channel.name}`);
        weaponsLibrary.getWeapons((err, data) =>
        {
            let weapons = data['weapons']['weapons'];

            let randomWeapon = weapons[Math.floor(Math.random() * weapons.length)];
            message.reply(`Your weapon is the **${randomWeapon.name}**`);
        });
    }

    if(message.content === `${config.prefix}togglemaps`)
    {
        // Make sure that if this is a server, only allow the owner to modify this
        if(message.channel.type === 'text')
        {
            if(message.guild.owner.id !== message.member.id)
            {
                logger.info(`Toggle maps refused for ${message.member.user.username} (${message.member.id})`);
                message.reply('Sorry, you must be the owner of this server to do that!');
                return;
            }
        }

        if(db.get('mapChannels').value().indexOf(message.channel.id) === -1)
        {
            logger.info(`Added map updates to ${message.channel.name} (${message.channel.id})`);
            db.get('mapChannels').push(message.channel.id).write();
            message.reply('Added map updates to this channel!');
        }
        else
        {
            logger.info(`Removed map updates from ${message.channel.name} (${message.channel.id})`);
            db.get('mapChannels').pull(message.channel.id).write();
            message.reply('Removed map updates to this channel!');
        }
        logger.info(`{On ${message.guild.name} (${message.guild.id})}`);
    }

    if(message.content === `${config.prefix}help`)
    {
        let msgData = [
            '**Command Usage:**',
            '',
            `**${config.prefix}help** - Show help`,
            '',
            `**${config.prefix}togglemaps** - Toggle the automatic updates of maps in this channel`,
            '',
            `**${config.prefix}weapons** - List all Splatoon 2 weapons`,
            '',
            `**${config.prefix}randomweapon** - Get a random weapon`,
            '',
            `**${config.prefix}stages** - List all Splatoon 2 stages`,
            '',
            `**${config.prefix}randomstage** [category] - Gets a random stage from the specified category. Options are reg, regular, splat, splatfest, salmon, salmonrun, and station. Defaults to regular.`
        ];
        message.channel.send(msgData.join("\n")).catch(logger.error);
    }
});

client.login(config.token).then(r => logger.info('Logged in successfully')).catch(e =>
{
    logger.error('Error logging in');
    logger.error(e);
});
client.on('shardError', error =>
{
    logger.error('Websocket error', error);
});
process.on('unhandledRejection', error =>
{
    logger.error('Unhandled promise rejection:', error);
});
