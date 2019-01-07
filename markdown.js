var http = require("http"),
	fs = require("fs"),
	mime = require("mime"),
	md = require("markdown-it")("default", {
		html: true, langPrefix: "prettyprint language-"
	}),
	mk = require("./markdown-it-katex");

const usage = "Usage: node markdown host <root directory>\n       node markdown build <root directory> [destination]";

const args = process.argv.slice(2);
if (args.length < 2) {
	console.log(usage);
	return;
}

var serverRoot = args[1];
if (!serverRoot.endsWith("/")) serverRoot += "/";

md
	.use(require("markdown-it-deflist"))
	.use(require("markdown-it-footnote"))
	.use(mk, {"throwOnError" : false, "errorColor" : " #cc0000"});

switch (args[0]) {
	case "host":
		host();
		break;
	case "build":
		build(args[2]);
		break;
	default:
		console.log(usage);
		break;
}

function directoryList(root) {
	try {
		var filenames = fs.readdirSync(serverRoot + root);
		var files = [
			{ path: "..", isDir: true },
		];

		var fileRoot = root.endsWith("/") ? root : root + "/";
		for (var i = 0; i < filenames.length; ++i) {
			if (filenames[i].startsWith(".")) continue;
			var stats = fs.statSync(serverRoot + fileRoot + filenames[i]);
			files.push({ path: filenames[i], isDir: stats.isDirectory() });
		}

		files.sort(function(a, b) {
			if (a.isDir && b.isDir) {
				return a.path.localeCompare(b.path);
			}
			else if (a.isDir) {
				return -1;
			}
			else if (b.isDir) {
				return 1;
			}
			else {
				return a.path.localeCompare(b.path);
			}
		});

		return "<ul>" + files.reduce(function(a, b) {
			return a + "<li><a href=\"" + fileRoot + b.path + "\">"
				+ (b.isDir ? "<b>" + b.path + "</b>" : b.path) + "</a></li>";
		}, "") + "</ul>";
	}
	catch (e) {
		return "<span>" + e + "</span>";
	}
}

function host() {

	var server = http.createServer(function(request, response) {
			var uri = decodeURI(request.url);
			var local;
			switch (uri) {
				case "/style.css":
				case "/favicon.ico":
					local = __dirname + uri;
					break;
				default:
					local  = serverRoot + uri;
					break;
			}

			fs.stat(local, function(err, stats) {
				var htmlBody = null;
				if (err) {
					if (err.errno === -2) {
						response.writeHead(404);
						response.end();
					}
					return;
				}

				// Look for file or directory
				var data;
				if (stats.isFile()) {
					data = fs.readFileSync(local);
					switch (local.substr(local.lastIndexOf(".") + 1)) {
						case "md":
							htmlBody = md.render(data.toString("utf-8"));
							break;
					}
				}
				else if (stats.isDirectory()) {
					htmlBody = directoryList(uri);
				}

				// Format and return
				if (htmlBody === null) {
					response.writeHead(200, {
						"Content-Type": mime.getType(local)
					});
					response.end(data, "binary");
				}
				else {
					fs.readFile(__dirname + "/template.html", "utf-8", function(err, data) {
						if (err) {
							console.log(err);
							response.writeHead(500);
							response.end();
							return;
						}
						
						response.writeHead(200, {
							"Content-Type": "text/html; charset=utf-8",
						});
						response.end(data.replace("<!--content-->", htmlBody));
					});
				}
			});
		}
	);

	server.listen(8080);
	console.log("Listening on port 8080");
}

function copy(src, dst) {
	if (src != dst) {
		console.log("Copying " + src + " to " + dst);
		fs.createReadStream(src).pipe(fs.createWriteStream(dst));
	}
	else {
		console.log("Source and destination are equivalent: " + dst);
	}
}

function mkdir(dir) {
	if (!fs.existsSync(dir)) {
		console.log("mkdir: " + dir);
		fs.mkdirSync(dir);
	}
}

function build(buildDir) {
	
	buildDir = buildDir || "build/";

	mkdir(buildDir);

	copy(__dirname + "/style.css", buildDir + "style.css");
	copy(__dirname + "/favicon.ico", buildDir + "favicon.ico");

	fullbuild(undefined, buildDir);

}

function fullbuild(root, buildDir) {

	var template = fs.readFileSync(__dirname + "/template.html", "utf-8");
	function render(html, output) {
		fs.writeFile(output, template.replace("<!--content-->", html));
	}

	root = root || "";
	buildDir = buildDir || "build/";

	if (!buildDir.endsWith("/")) buildDir += "/";

	console.log("Building " + root);

	mkdir(buildDir + root);

	var filenames = fs.readdirSync(serverRoot + root);
	for (var i = 0; i < filenames.length; ++i) {

		if (filenames[i].startsWith(".")) continue;

		var rel = root + filenames[i];
		var local = serverRoot + rel;
		var stats = fs.statSync(local);
		
		if (stats.isDirectory()) {
			if (!rel.endsWith("/")) {
				rel += "/";
			}
			if (!fs.existsSync(rel + "index.md")) {
				render(directoryList(rel), buildDir + rel + "index.html");
			}
			fullbuild(rel, buildDir);
		}
		else {

			switch (rel.substr(rel.lastIndexOf(".") + 1)) {

				case "md":
					var dest = (buildDir + rel).replace(/\.md$/, ".html");
					console.log("Rendering " + local + " to " + dest);
					var data = fs.readFileSync(local, "utf-8");
					var htmlBody = md.render(data);
					htmlBody = htmlBody.replace(/\.md/g, ".html");
					render(htmlBody, dest);
					break;

				default:
					console.log("Copying " + rel);
					copy(local, buildDir + rel);
					break;

			}

		}
	}
}
