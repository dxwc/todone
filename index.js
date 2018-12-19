let path = require('path');
let fs   = require('fs');

let sqlite3 = require('sqlite3').verbose();
let uuid4   = require('uuid/v4');
let val     = require('validator');

const dot = path.join(require('os').homedir(), '.todone');

try
{
    if(!fs.statSync(dot).isDirectory())
    {
        console.error
        (
            `=> Error:\nCan not create a directory as there is an existing file `
            `with the same name ( ${dot} ). Remove/rename the file and `
            `then re-run to continue`
        );
        process.exit(1);
    }
}
catch(err)
{
    if(err.code === 'ENOENT')
    {
        try
        {
            fs.mkdirSync(dot);
        }
        catch(err)
        {
            console.error(`=> Error creating directory ${dot}`);
            console.error(err);
            process.exit(1);
        }
    }
    else
    {
        console.error('=> Unhandled Error\n');
        console.error(err);
        process.exit(1);
    }
}

function db_run(command)
{
    return new Promise((resolve, reject) =>
    {
        global.db.run
        (
            command,
            (err) =>
            {
                if(err) return reject(err);
                else return resolve();
            }
        );
    });
}

function init_db()
{
    return new Promise((resolve, reject) =>
    {
        global.db = new sqlite3.Database(path.join(dot, 'todone.db'), (err) =>
        {
            if(err)
            {
                console.error('Error opening database');
                return reject(err);
            }

            db_run
            (
                `
                CREATE TABLE IF NOT EXISTS task
                (
                    id          TEXT PRIMARY KEY,
                    parent      TEXT,
                    description TEXT NOT NULL,
                    created     INTEGER NOT NULL DEFAULT (STRFTIME('%s', 'now')),
                    updated     INTEGER NOT NULL DEFAULT (STRFTIME('%s', 'now'))
                );
                `
            )
            .then(() =>
            {
                return resolve();
            })
            .catch((err) =>
            {
                console.error('Error setting up database table');
                if(global.db) global.db.close();
                return reject(err);
            });
        });
    });
}

function add_task(task_description, parent_id)
{
    if(typeof(task_description) !== 'string')
        return Promise.reject('Invalid use of function');

    let valid_parent = false;
    if(typeof(parent_id) === 'string' && val.isUUID(parent_id, 4))
        valid_parent = true;

    return db_run
    (
        `
        INSERT INTO task
        (
            id,
            ${valid_parent ? `parent,` : ''}
            description
        )
        VALUES
        (
            '${uuid4()}',
            ${valid_parent ? `'${parent_id}',`: ''}
            '${val.escape(task_description)}'
        );
        `
    );
}