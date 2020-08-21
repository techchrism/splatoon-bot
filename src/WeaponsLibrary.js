const vm = require('vm');
const request = require('request');

class WeaponsLibrary
{
    constructor(db, logger)
    {
        this.db = db;
        this.logger = logger;
        this.db.defaults({
            weapons: {}
        }).write();
        this.lastUpdated = null;
        this.cachedWeaponsList = [];
    }
    
    forceUpdate(callback)
    {
        request.get('https://nkitten.net/splatoon2/res/script/weaponlist.js', (error, response, body) =>
        {
            let sandbox = {};
            vm.createContext(sandbox);
            vm.runInContext(body, sandbox);
            
            this.db.set('weapons', sandbox['weaponlist']).write();
    
            let weaponsList = '';
            this.cachedWeaponsList = [];
            for(let i = 0; i < sandbox['weaponlist']['weapons'].length; i++)
            {
                if(weaponsList.length > 1024)
                {
                    this.cachedWeaponsList.push(weaponsList);
                    weaponsList = '';
                }
                weaponsList += sandbox['weaponlist']['weapons'][i].name;
                if(i !== sandbox['weaponlist']['weapons'].length - 1)
                {
                    weaponsList += ', ';
                }
            }
            this.cachedWeaponsList.push(weaponsList);
            
            callback(null, {
                weapons: sandbox['weaponlist'],
                cachedWeaponsList: this.cachedWeaponsList
            });
        });
    }
    
    getWeapons(callback)
    {
        let now = new Date();
        
        // Reload weapons if it's been more than a day
        if(this.lastUpdated === null || (this.lastUpdated - now) >= 1000 * 60 * 60 * 24)
        {
            this.logger.info('Reloading weapons');
            this.lastUpdated = now;
            this.forceUpdate(callback);
        }
        else
        {
            callback(null, {
                weapons: this.db.get('weapons').value(),
                cachedWeaponsList: this.cachedWeaponsList
            });
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
