const vm = require('vm');
const fs = require('fs');
const fetch = require('node-fetch');

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
    
    async forceUpdate()
    {
        const data = await (await fetch('http://nkitten.net/splatoon2/res/script/stagesmodes.js')).text();
        let sandbox = {};
        vm.createContext(sandbox);
        vm.runInContext(data, sandbox);
        sandbox['stagesmodes']['stages_station'] = [];
        for(let name of this.manuallyAdded)
        {
            sandbox['stagesmodes']['stages_station'].push({
                name: name
            });
        }
        
        this.db.set('stages', sandbox['stagesmodes']).write();
        return sandbox['stagesmodes'];
    }
    
    async getStages()
    {
        let now = new Date();
        
        // Reload weapons if it's been more than a day
        if(this.lastUpdated === null || (this.lastUpdated - now) >= 1000 * 60 * 60 * 24)
        {
            this.logger.info('Reloading stages');
            this.lastUpdated = now;
            return (await this.forceUpdate());
        }
        else
        {
            return this.db.get('stages').value();
        }
    }
}

module.exports = StagesLibrary;
