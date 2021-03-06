# Splatoon 2 Discord Bot

This is a simple discord bot that features the abilities to output every stage/weapon currently in the game, provide random weapons, and provide random stages - including splatfest stages!

## Installation

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org) (which comes with [npm](https://npmjs.com)) installed on your computer. From your command line:

```bash
# Clone this repository
git clone https://github.com/TheTechdoodle/splatoon-bot.git
# Go into the repository
cd splatoon-bot
# Install dependencies
npm install
# Run the app
npm start
```

## Configuration
The configuration file will be created automatically
```json
{
    "prefix": "!",
    "token": "discord bot token"
}
```
You can also use `.env` for the environment variables `TOKEN` and `PREFIX`or use the command line arguments `--token=` and `--prefix=`\
If a command line option isn't provided, it will search the environment variables and if that doesn't exist, it will load the value from the config\
Additionally, you can use the command line argument `--config=` to specify a custom config path

You can get your bot's token from discord's [developer page](https://discordapp.com/developers/applications).

## Usage
These bot commands must start with the prefix you've configured

Command | Description
--- | ---
help | Shows the help message
togglemaps | Toggles whether to provide updates in the current channel when maps rotate
weapons | Lists all weapons currently in Splatoon 2
randomweapon | Get a random weapon
stages | Lists all stages currently in Splatoon 2, including splatfest stages
randomstage | Gets a random stage from any category (default is regular). Options are regular, splatfest, and salmon.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
