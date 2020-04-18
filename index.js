const fs = require('fs');
const Discord = require('discord.js');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const WeaponsLibrary = require('./src/WeaponsLibrary');
const MapsLibrary = require('./src/MapsLibrary');
const StagesLibrary = require('./src/StagesLibrary');
const {createLogger, format, transports} = require('winston');
const {combine, timestamp, label, prettyPrint, printf} = format;
require('winston-daily-rotate-file');

// Begin logging
const fileTransport = new (transports.DailyRotateFile)({
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
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

logger.info("Started logging");

const adapter = new FileSync('db.json');
const db = low(adapter);
const weaponsLibrary = new WeaponsLibrary(db);
const stagesLibrary = new StagesLibrary(db);
const mapsLibrary = new MapsLibrary();
let token = JSON.parse(fs.readFileSync('settings.json'))['token'];
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
        if(client.channels.has(ch))
        {
            let channel = client.channels.get(ch);
            
            // Make sure it's a text-based channel (instead of a voice or category)
            if(['text', 'dm', 'group'].indexOf(channel.type) !== -1)
            {
                for(let msg of data)
                {
                    channel.send(msg);
                }
            }
        }
    }
}

function sendMapData(data)
{
    logger.info("Sending map data");
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
    let embed = new Discord.RichEmbed();
    embed.setTitle('Refresh In');
    let timeUntil = mapsLibrary.getRefreshInSimple();
    let timeText = timeUntil.hours + ' hours';
    if(timeUntil.minutes !== 0)
    {
        timeText += ', ' + timeUntil.minutes + ' minutes';
    }
    embed.setDescription(timeText);
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
    logger.info('Logged in as "' + client.user.tag + '"');
    
    // Start the timer to send the messages
    mapsLibrary.on('data', (data) =>
    {
        logger.info('Got data');
        sendMapData(data);
    });
    mapsLibrary.load();
});

client.on('message', (message) =>
{
    if(message.content === '!weapons')
    {
        // Send a list of weapons
        logger.info("Sending weapons");
        weaponsLibrary.getWeapons((err, data) =>
        {
            let weaponsList = '';
            for(let i = 0; i < data['weapons'].length; i++)
            {
                weaponsList += data['weapons'][i].name;
                if(i !== data['weapons'].length - 1)
                {
                    weaponsList += ', ';
                }
            }
            
            let weaponsEmbed = new Discord.MessageEmbed()
                .setColor(5504768)
                .setTitle('All Splatoon 2 Weapons:')
                .setDescription(weaponsList);

            message.channel.send(weaponsEmbed);
        });
    }
    
    if(message.content === '!stages')
    {
        // Send a list of stages
        logger.info("Sending stages");
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
                let stagesList = '';
                for(let i = 0; i < data[scrape.key].length; i++)
                {
                    stagesList += data[scrape.key][i].name;
                    if(i !== data[scrape.key].length - 1)
                    {
                        stagesList += ', ';
                    }
                }
                stagesEmbed.addField(scrape.name, stagesList);
            }
            
            message.channel.send(stagesEmbed);
        });
    }
    
    if(message.content.startsWith('!randomstage'))
    {
        logger.info("Sending random stage");
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
                message.reply('Your stage is **' + randomMap['name'] + '**');
            });
        }
    }
    
    if(message.content === '!randomweapon')
    {
        logger.info("Sending random weapon");
        weaponsLibrary.getWeapons((err, data) =>
        {
            let weapons = data['weapons'];
            
            let randomWeapon = weapons[Math.floor(Math.random() * weapons.length)];
            message.reply('Your weapon is the **' + randomWeapon.name + '**');
        });
    }
    
    if(message.content === '!togglemaps')
    {
        // Make sure that if this is a server, only allow the owner to modify this
        if(message.channel.type === 'text')
        {
            if(message.guild.owner.id !== message.member.id)
            {
                logger.info(`Toggle maps refused for ${message.member.name} (${message.member.id})`);
                message.reply('Sorry, you must be the owner of this server to do that!');
                return;
            }
        }
        
        if(db.get('mapChannels').value().indexOf(message.channel.id) === -1)
        {
            logger.info("Added map updates to " + message.channel.name + " (" + message.channel.id + ")");
            db.get('mapChannels').push(message.channel.id).write();
            message.reply('Added map updates to this channel!');
        }
        else
        {
            logger.info("Removed map updates from " + message.channel.name + " (" + message.channel.id + ")");
            db.get('mapChannels').pull(message.channel.id).write();
            message.reply('Removed map updates to this channel!');
        }
        logger.info(`{On ${message.guild.name} (${message.guild.id})}`);
    }
    
    if(message.content === '!help')
    {
        let msgData = [
            '**Command Usage:**',
            '',
            '__!help__ - Show help',
            '',
            '__!togglemaps__ - Toggle the automatic updates of maps in this channel',
            '',
            '__!weapons__ - List all Splatoon 2 weapons',
            '',
            '__!randomweapon__ - Get a random weapon',
            '',
            '__!stages__ - List all Splatoon 2 stages',
            '',
            '__!randomstage__ [category] - Gets a random stage from the specified category. Options are reg, regular, splat, splatfest, salmon, salmonrun, and station. Defaults to regular.'
        ];
        message.channel.send(msgData.join("\n"));
    }
});

client.login(token).then(r => logger.info("Logged in")).catch(e =>
{
    logger.error("Error logging in");
    logger.error(e);
});
