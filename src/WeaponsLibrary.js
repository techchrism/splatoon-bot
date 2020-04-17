const vm = require('vm');
const request = require('request');

class WeaponsLibrary
{
    constructor(db)
    {
        this.db = db;
        this.db.defaults({
            weapons: {}
        }).write();
        this.lastUpdated = null;
    }
    
    forceUpdate(callback)
    {
        request.get('https://nkitten.net/splatoon2/res/script/weaponlist.js', (error, response, body) =>
        {
            let sandbox = {};
            vm.createContext(sandbox);
            vm.runInContext(body, sandbox);
            
            this.db.set('weapons', sandbox['weaponlist']).write();
            
            callback(null, sandbox['weaponlist']);
        });
    }
    
    getWeapons(callback)
    {
        let now = new Date();
        
        // Reload weapons if it's been more than a day
        if(this.lastUpdated === null || (this.lastUpdated - now) >= 1000 * 60 * 60 * 24)
        {
            this.lastUpdated = now;
            this.forceUpdate(callback);
        }
        else
        {
            callback(null, this.db.get('weapons').value());
        }
    }
    
    getWeaponsSorted(callback)
    {
        this.getWeapons((err, data) =>
        {
            if(err)
            {
                callback(err);
                return;
            }
            
            data['weapons'].sort((a, b) =>
            {
                if(a.name < b.name)
                {
                    return -1;
                }
                if(a.name > b.name)
                {
                    return 1;
                }
                return 0;
            });
            
            callback(null, data);
        })
    }
}

module.exports = WeaponsLibrary;