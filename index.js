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
                    progress    INTEGER DEFAULT 0 CHECK
                                (progress >= 0 AND progress <= 100),
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

function is_str(input)
{
    return input && input.constructor === String;
}

function add_task(task_description, parent_id)
{
    return new Promise((resolve, reject) =>
    {
        if(!is_str(task_description))
            reject(new Error('Invalid use of functions'));

        let valid_parent = false;

        if(is_str(parent_id) && val.isUUID(parent_id, 4))
            valid_parent = true;

        let id = uuid4();

        db_run
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
                '${id}',
                ${valid_parent ? `'${parent_id}',`: ''}
                '${val.escape(task_description)}'
            );
            `
        )
        .then(() =>
        {
            resolve(id);
        })
        .catch((err) =>
        {
            reject(err);
        });
    });
}

function update_task(id, description, progress, parent)
{
    return new Promise((resolve, reject) =>
    {
        let is_valid_parent      = false;
        let is_valid_description = false;
        let is_valid_progress    = false;

        if(!is_str(id) || !val.isUUID(id, 4))
            return reject(new Error('id is a required field'));

        if(is_str(parent) && val.isUUID(parent, 4))
            is_valid_parent = true;
        if(is_str(description))
        {
            is_valid_description = true;
            description = val.escape(description);
        }

        if(typeof(progress) === 'number' && progress >= 0 && progress <= 100)
            is_valid_progress = true;

        db_run
        (
            `
            UPDATE task
            SET
                ${
                    is_valid_parent ?
                    `parent = '${parent}' ${is_valid_description ? `,` : ''}`
                    : ''
                }${
                    is_valid_description ?
                    `description = '${description}' ${is_valid_progress  ? `,` : ''}`
                    : ''
                }${
                    is_valid_progress ?
                    `progress = ${progress}`
                    : ''
                }
            WHERE id = '${id}';
            `
        )
        .then(() =>
        {
            return resolve(id);
        })
        .catch((err) =>
        {
            return reject(err);
        });
    });
}