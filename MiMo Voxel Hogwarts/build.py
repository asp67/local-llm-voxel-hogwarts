# Assembles the single-file index.html from src/template.html + vendor + scene sources
import pathlib
root = pathlib.Path(__file__).parent
template = (root / "src" / "template.html").read_text(encoding="utf-8")
three = (root / "vendor" / "three.min.js").read_text(encoding="utf-8")
scene = (root / "src" / "scene.js").read_text(encoding="utf-8")
html = template.replace('<script src="vendor/three.min.js"></script>',
                        "<script>\n" + three + "\n</script>")
html = html.replace('<script src="src/scene.js"></script>',
                    "<script>\n" + scene + "\n</script>")
if "vendor/three.min.js" in html or "src/scene.js" in html:
    raise SystemExit("inline failed: script tags not found in template")
(root / "index.html").write_text(html, encoding="utf-8")
print("built index.html:", len(html), "bytes")
