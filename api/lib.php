<?php
// Shared helpers for the feedback endpoint and its admin page.
// Settings can be overridden in config.local.php (not in git), see config.sample.php.
declare(strict_types=1);

function zz_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $config = [
        // Outside the web root by default: three levels up from api/
        // (…/htdocs/ZzWorld/api → …/zzworld-data). Override on servers where
        // that is not writable or not outside the web root.
        'data_dir' => getenv('ZZWORLD_DATA_DIR') ?: dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'zzworld-data',
        // password_hash() of the admin key; empty = admin page shows setup help
        'admin_key_hash' => '',
        // all feedback together, per hour (no per-person limits: we keep no IPs)
        'max_per_hour' => 300,
    ];
    $local = __DIR__ . '/config.local.php';
    if (is_file($local)) {
        $config = array_merge($config, require $local);
    }
    return $config;
}

function zz_db(): PDO
{
    static $db = null;
    if ($db !== null) {
        return $db;
    }
    $dir = zz_config()['data_dir'];
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('data directory cannot be created');
    }
    $db = new PDO('sqlite:' . $dir . DIRECTORY_SEPARATOR . 'feedback.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec('CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,          -- only the date, no time of day
        kind TEXT NOT NULL,         -- kid | parent
        mood INTEGER,               -- kid: 1–5
        tags TEXT,                  -- kid: comma separated
        category TEXT,              -- parent: idea | bug | other
        text TEXT,                  -- parent: the message
        lang TEXT,
        version TEXT
    )');
    $db->exec('CREATE TABLE IF NOT EXISTS rate (hour TEXT PRIMARY KEY, count INTEGER NOT NULL)');
    return $db;
}

function zz_json(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body);
    exit;
}
