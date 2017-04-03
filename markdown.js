var http = require("http"),
	fs = require("fs"),
	mime = require("mime"),
	md = require("markdown-it")("default", {
		html: true, langPrefix: "prettyprint language-"
	}),
	mk = require("./markdown-it-katex");

const serverRoot = "/home/jamie/notes/";

md
	.use(require("markdown-it-deflist"))
	.use(mk, {"throwOnError" : false, "errorColor" : " #cc0000"});

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

function directoryTree(root, level) {
	try {
		var rel = root.substr(root.lastIndexOf("/") + 1);
		var thisHtml = "<a href='" + root + "'>" + rel + "</a>";

		var stats = fs.statSync(serverRoot + root)
		if (stats.isDirectory()) thisHtml = "<b>" + thisHtml + "</b>";
		if (!stats.isDirectory() || level > 2)
			return thisHtml;

		var files = fs.readdirSync(serverRoot + root);
		var list = "";
		var fileRoot = root.endsWith("/") ? root : root + "/";
		
		for (var f in files) {
			if (files[f][0] == ".") continue;
			list += "<li>" + directoryTree(fileRoot + files[f], level + 1) + "</li>";
		}
		return thisHtml  + "<ul>" + list + "</ul>";
	}
	catch (e) {
		return "<span>" + e + "</span>";
	}
}

var server = http.createServer(function(request, response) {
		console.log(request.url);
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
				htmlBody = directoryList(request.url);
			}

			// Format and return
			if (htmlBody === null) {
				response.writeHead(200, {
					"Content-Type": mime.lookup(local)
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
