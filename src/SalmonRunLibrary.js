const events = require('events');
const request = require('request');

class SalmonRunLibrary extends events.EventEmitter
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
        request.get('https://splatoon2.ink/data/coop-schedules.json', (error, response, body) =>
        {
            this.data = JSON.parse(body);
            
            let refreshAt = this.data['details'][1]['start_time'] * 1000;
            let refreshIn = refreshAt - Date.now();
            this.refreshIn = refreshIn;
            this.logger.info(`Refreshing salmon run in ${Math.ceil(refreshIn / 1000)} seconds`);
            
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
    
    getFormattedTime(ms)
    {
        let hours = Math.ceil(ms / (1000 * 60 * 60));
        let minutes = Math.ceil(ms - (hours * 1000 * 60 * 60) / 1000 * 60) % 60;
        
        return {
            hours: hours,
            minutes: minutes
        };
    }
    
    getFormattedString(ms)
    {
        const formatted = this.getFormattedTime(ms);
        return (formatted.hours + ' hour' + (formatted.hours > 1 ? 's' : '') + (formatted.minutes > 0 ?
            ' ' + (formatted.minutes + ' minute' + (formatted.minutes > 1 ? 's' : '')) : ''));
    }
    
    getCurrentEndString()
    {
        return this.getFormattedString((this.data['details'][0]['end_time'] * 1000) - Date.now());
    }
    
    getFutureStartString()
    {
        return this.getFormattedString((this.data['details'][1]['start_time'] * 1000) - Date.now());
    }
}

module.exports = SalmonRunLibrary;
