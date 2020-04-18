const events = require('events');
const request = require('request');

class MapsLibrary extends events.EventEmitter
{
    constructor(logger)
    {
        super();
        
        this.logger = logger;
        this.data = {};
        this.refreshIn = 0;
    }
    
    load()
    {
        request.get('https://splatoon2.ink/data/schedules.json', (error, response, body) =>
        {
            this.data = JSON.parse(body);
            
            let refreshAt = this.data['regular'][0]['end_time'] * 1000;
            let refreshIn = refreshAt - Date.now();
            this.refreshIn = refreshIn;
            this.logger.info('Refreshing in ' + Math.ceil(refreshIn / 1000) + ' seconds!');
            
            if(refreshIn <= 0)
            {
                // If the data hasn't reloaded yet, wait 10 more seconds before retrying
                setTimeout(() =>
                {
                    this.load();
                }, 10000);
            }
            else
            {
                this.emit('data', this.data);
    
                setTimeout(() =>
                {
                    this.load();
                }, refreshIn + 15000); // Add 15 seconds for the api to catch up
            }
        });
    }
    
    getRefreshInSimple()
    {
        let hours = Math.ceil(this.refreshIn / (1000 * 60 * 60));
        let minutes = Math.ceil(this.refreshIn - (hours * 1000 * 60 * 60) / 1000 * 60) % 60;
        
        return {
            hours: hours,
            minutes: minutes
        };
    }
}

module.exports = MapsLibrary;
