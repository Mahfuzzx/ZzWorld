<?php
// Copy to config.local.php (it is ignored by git) and fill in.
return [
    // Where the feedback database lives. Must be OUTSIDE the web root and
    // writable by the web server, e.g. '/var/lib/zzworld' or 'C:/zzworld-data'.
    // 'data_dir' => '/var/lib/zzworld',

    // Create it on api/admin.php (setup form) or with:
    //   php -r "echo password_hash('a long secret key', PASSWORD_DEFAULT), PHP_EOL;"
    'admin_key_hash' => '',

    // Total feedback accepted per hour from everybody together.
    // 'max_per_hour' => 300,
];
