const vm = require('vm');
const request = require('request');
const fs = require('fs');

class StagesLibrary
{
    constructor(db, logger)
    {
        this.db = db;
        this.logger = logger;
        this.db.defaults({
            stages: {}
        }).write();
        this.lastUpdated = null;
        let manualData = '';
        try
        {
            manualData = fs.readFileSync('manually-added.json');
        }
        catch(err)
        {
            this.logger.warn('No manually-added.json file');
        }
        this.manuallyAdded = manualData === '' ? [] : JSON.parse(manualData)['custom'];
    }
    
    forceUpdate(callback)
    {
        request.get('http://nkitten.net/splatoon2/res/script/stagesmodes.js', (error, response, body) =>
        {
            let sandbox = {};
            vm.createContext(sandbox);
            vm.runInContext(body, sandbox);
            sandbox['stagesmodes']['stages_station'] = [];
            for(let name of this.manuallyAdded)
            {
                sandbox['stagesmodes']['stages_station'].push({
                    name: name
                });
            }
            
            this.db.set('stages', sandbox['stagesmodes']).write();
            
            callback(null, sandbox['stagesmodes']);
        });
    }
    
    getStages(callback)
    {
        let now = new Date();
        
        // Reload weapons if it's been more than a day
        if(this.lastUpdated === null || (this.lastUpdated - now) >= 1000 * 60 * 60 * 24)
        {
            this.logger.info("Reloading stages");
            this.lastUpdated = now;
            this.forceUpdate(callback);
        }
        else
        {
            callback(null, this.db.get('stages').value());
        }
    }
}

module.exports = StagesLibrary;
