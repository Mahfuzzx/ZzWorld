<?php
// Anonymous feedback from the game.
//
// Stored: the date (no time), kind, the chosen mood/pictures or the parent's
// text, language and game version. NOT stored: IP address, user agent,
// cookies or any identifier. Keep this URL out of the web server's access
// log as well (see docs/GELISTIRME.md).
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    zz_json(405, ['error' => 'method']);
}

// Only the game itself may send (blocks other websites posting here).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
    zz_json(403, ['error' => 'origin']);
}

$raw = file_get_contents('php://input', false, null, 0, 4097);
if ($raw === false || strlen($raw) > 4096) {
    zz_json(413, ['error' => 'size']);
}
$in = json_decode($raw, true);
if (!is_array($in)) {
    zz_json(400, ['error' => 'json']);
}

$kind = $in['kind'] ?? '';
$lang = in_array($in['lang'] ?? '', ['tr', 'en'], true) ? $in['lang'] : null;
$version = is_string($in['version'] ?? null) && preg_match('/^[0-9A-Za-z.\-]{1,20}$/', $in['version']) ? $in['version'] : null;
$row = ['kind' => $kind, 'mood' => null, 'tags' => null, 'category' => null, 'text' => null];

if ($kind === 'kid') {
    $mood = $in['mood'] ?? null;
    if (!is_int($mood) || $mood < 1 || $mood > 5) {
        zz_json(400, ['error' => 'mood']);
    }
    $allowed = ['love', 'idea', 'bug', 'hard'];
    $tags = array_values(array_unique(array_filter(is_array($in['tags'] ?? null) ? $in['tags'] : [], fn ($t) => in_array($t, $allowed, true))));
    $row['mood'] = $mood;
    $row['tags'] = implode(',', $tags);
} elseif ($kind === 'parent') {
    $category = in_array($in['category'] ?? '', ['idea', 'bug', 'other'], true) ? $in['category'] : 'other';
    $text = is_string($in['text'] ?? null) ? $in['text'] : '';
    // no control characters except new lines; at most 1000 characters
    $text = preg_replace('/[^\P{C}\n]/u', '', $text) ?? '';
    $text = trim(mb_substr($text, 0, 1000));
    if ($text === '') {
        zz_json(400, ['error' => 'text']);
    }
    $row['category'] = $category;
    $row['text'] = $text;
} else {
    zz_json(400, ['error' => 'kind']);
}

try {
    $db = zz_db();
    // one shared hourly limit for everybody: no per-person data needed
    $hour = gmdate('Y-m-d\TH');
    $db->prepare('INSERT INTO rate (hour, count) VALUES (?, 1) ON CONFLICT(hour) DO UPDATE SET count = count + 1')->execute([$hour]);
    $count = (int) $db->query('SELECT count FROM rate WHERE hour = ' . $db->quote($hour))->fetchColumn();
    if ($count > (int) zz_config()['max_per_hour']) {
        zz_json(429, ['error' => 'busy']);
    }
    $db->exec("DELETE FROM rate WHERE hour < '" . gmdate('Y-m-d\TH', time() - 86400) . "'");

    $db->prepare('INSERT INTO feedback (day, kind, mood, tags, category, text, lang, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([gmdate('Y-m-d'), $row['kind'], $row['mood'], $row['tags'], $row['category'], $row['text'], $lang, $version]);
} catch (Throwable $e) {
    error_log('ZzWorld feedback: ' . $e->getMessage());
    zz_json(500, ['error' => 'storage']);
}

zz_json(200, ['ok' => true]);
