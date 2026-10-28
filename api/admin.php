<?php
// Feedback reading page. Opens only with the admin key (see config.sample.php).
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

session_set_cookie_params(['lifetime' => 0, 'path' => dirname($_SERVER['SCRIPT_NAME']), 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
session_name('zzadmin');
session_start();

$config = zz_config();
$e = fn ($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$csrf = $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$message = '';

if ($post && ($_POST['action'] ?? '') === 'login' && $config['admin_key_hash'] !== '') {
    if (password_verify((string) ($_POST['key'] ?? ''), $config['admin_key_hash'])) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
    } else {
        sleep(2); // slow down guessing
        $message = 'Anahtar yanlış.';
    }
}
if ($post && ($_POST['action'] ?? '') === 'logout') {
    $_SESSION = [];
    session_destroy();
    header('Location: ' . $_SERVER['SCRIPT_NAME']);
    exit;
}
$admin = !empty($_SESSION['admin']);
if ($admin && $post && ($_POST['action'] ?? '') === 'delete' && hash_equals($csrf, (string) ($_POST['csrf'] ?? ''))) {
    zz_db()->prepare('DELETE FROM feedback WHERE id = ?')->execute([(int) ($_POST['id'] ?? 0)]);
    $message = 'Silindi.';
}

$hashHelp = '';
if ($config['admin_key_hash'] === '' && $post && ($_POST['action'] ?? '') === 'hash' && strlen((string) ($_POST['key'] ?? '')) >= 12) {
    $hashHelp = password_hash((string) $_POST['key'], PASSWORD_DEFAULT);
}
?><!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ZzWorld · Geri bildirimler</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f6e7c8; color: #3b2f2a; }
  main { max-width: 960px; margin: 0 auto; }
  .box { background: #fffaf0; border: 3px solid #3b2f2a; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border-bottom: 1px solid #e6d6b8; padding: 6px; text-align: left; vertical-align: top; }
  .text { white-space: pre-wrap; }
  .bar { display: inline-block; height: 12px; background: #e8735a; border-radius: 6px; vertical-align: middle; }
  input, button { font: inherit; padding: 6px 10px; border-radius: 8px; border: 2px solid #3b2f2a; }
  code { background: #fff; padding: 2px 4px; word-break: break-all; }
</style>
</head>
<body><main>
<h1>ZzWorld · Geri bildirimler</h1>
<?php if ($message): ?><p><strong><?= $e($message) ?></strong></p><?php endif; ?>

<?php if ($config['admin_key_hash'] === ''): ?>
  <div class="box">
    <h2>Kurulum</h2>
    <p>Okuma sayfası için henüz bir anahtar belirlenmemiş. En az 12 karakterlik bir anahtar yazın;
      sayfa onun özetini (hash) gösterecek. Anahtarın kendisi hiçbir yere kaydedilmez.</p>
    <form method="post">
      <input type="hidden" name="action" value="hash">
      <input type="password" name="key" minlength="12" required autocomplete="new-password">
      <button>Özet oluştur</button>
    </form>
    <?php if ($hashHelp): ?>
      <p>Bu satırı <code>api/config.local.php</code> dosyasına ekleyin (örnek: <code>api/config.sample.php</code>):</p>
      <p><code>'admin_key_hash' =&gt; '<?= $e($hashHelp) ?>',</code></p>
    <?php endif; ?>
  </div>
<?php elseif (!$admin): ?>
  <div class="box">
    <form method="post">
      <input type="hidden" name="action" value="login">
      <label>Anahtar <input type="password" name="key" required autocomplete="current-password"></label>
      <button>Aç</button>
    </form>
  </div>
<?php else:
    $db = zz_db();
    $moods = $db->query("SELECT mood, COUNT(*) AS n FROM feedback WHERE kind = 'kid' GROUP BY mood")->fetchAll(PDO::FETCH_KEY_PAIR);
    $tagCounts = ['love' => 0, 'idea' => 0, 'bug' => 0, 'hard' => 0];
    foreach ($db->query("SELECT tags FROM feedback WHERE kind = 'kid' AND tags <> ''")->fetchAll(PDO::FETCH_COLUMN) as $tags) {
        foreach (explode(',', $tags) as $t) {
            if (isset($tagCounts[$t])) {
                $tagCounts[$t]++;
            }
        }
    }
    $total = array_sum($moods);
    $rows = $db->query('SELECT * FROM feedback ORDER BY id DESC LIMIT 300')->fetchAll();
    $faces = [1 => '😢', 2 => '🙁', 3 => '😐', 4 => '🙂', 5 => '😍'];
    $tagNames = ['love' => '❤️ çok sevdim', 'idea' => '💡 fikir', 'bug' => '🐞 bozuk', 'hard' => '❓ zor'];
?>
  <div class="box">
    <form method="post" style="float:right"><input type="hidden" name="action" value="logout"><button>Çıkış</button></form>
    <h2>Çocuklar (<?= $total ?>)</h2>
    <?php for ($m = 5; $m >= 1; $m--): $n = (int) ($moods[$m] ?? 0); ?>
      <div><?= $faces[$m] ?> <span class="bar" style="width:<?= $total ? round(300 * $n / $total) : 0 ?>px"></span> <?= $n ?></div>
    <?php endfor; ?>
    <p><?php foreach ($tagCounts as $t => $n): ?><?= $e($tagNames[$t]) ?>: <strong><?= $n ?></strong> &nbsp; <?php endforeach; ?></p>
  </div>
  <div class="box">
    <h2>Son geri bildirimler</h2>
    <table>
      <tr><th>Tarih</th><th>Tür</th><th>İçerik</th><th>Dil / sürüm</th><th></th></tr>
      <?php foreach ($rows as $r): ?>
        <tr>
          <td><?= $e($r['day']) ?></td>
          <td><?= $r['kind'] === 'kid' ? 'çocuk' : 'ebeveyn · ' . $e($r['category']) ?></td>
          <td class="text"><?php if ($r['kind'] === 'kid'): ?><?= $faces[(int) $r['mood']] ?? '' ?> <?= $e(implode(' ', array_map(fn ($t) => $tagNames[$t] ?? $t, array_filter(explode(',', (string) $r['tags']))))) ?><?php else: ?><?= $e($r['text']) ?><?php endif; ?></td>
          <td><?= $e($r['lang']) ?> / <?= $e($r['version']) ?></td>
          <td><form method="post"><input type="hidden" name="action" value="delete"><input type="hidden" name="csrf" value="<?= $e($csrf) ?>"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><button>Sil</button></form></td>
        </tr>
      <?php endforeach; ?>
    </table>
  </div>
<?php endif; ?>
</main></body>
</html>
