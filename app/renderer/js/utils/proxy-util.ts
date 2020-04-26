import * as ConfigUtil from './config-util';

export interface ProxyRule {
	hostname?: string;
	port?: number;
}

// Return proxy to be used for a particular uri, to be used for request
export function getProxy(_uri: string): ProxyRule | void {
	let uri;
	try {
		uri = new URL(_uri);
	} catch (error) {
		return;
	}

	const proxyRules = ConfigUtil.getConfigItem('proxyRules', '').split(';');
	// If SPS is on and system uses no proxy then request should not try to use proxy from
	// environment. NO_PROXY = '*' makes request ignore all environment proxy variables.
	if (proxyRules[0] === '') {
		process.env.NO_PROXY = '*';
		return;
	}

	const proxyRule: any = {};
	if (uri.protocol === 'http:') {
		proxyRules.forEach((proxy: string) => {
			if (proxy.includes('http=')) {
				proxyRule.hostname = proxy.split('http=')[1].trim().split(':')[0];
				proxyRule.port = proxy.split('http=')[1].trim().split(':')[1];
			}
		});
		return proxyRule;
	}

	if (uri.protocol === 'https:') {
		proxyRules.forEach((proxy: string) => {
			if (proxy.includes('https=')) {
				proxyRule.hostname = proxy.split('https=')[1].trim().split(':')[0];
				proxyRule.port = proxy.split('https=')[1].trim().split(':')[1];
			}
		});
		return proxyRule;
	}
}

// TODO: Refactor to async function
export async function resolveSystemProxy(mainWindow: Electron.BrowserWindow): Promise<void> {
	const page = mainWindow.webContents;
	const ses = page.session;
	const resolveProxyUrl = 'www.example.com';

	// Check HTTP Proxy
	const httpProxy = (async () => {
		const proxy = await ses.resolveProxy('http://' + resolveProxyUrl);
		let httpString = '';
		if (proxy !== 'DIRECT') {
			// In case of proxy HTTPS url:port, windows gives first word as HTTPS while linux gives PROXY
			// for all other HTTP or direct url:port both uses PROXY
			if (proxy.includes('PROXY') || proxy.includes('HTTPS')) {
				httpString = 'http=' + proxy.split('PROXY')[1] + ';';
			}
		}

		return httpString;
	})();
	// Check HTTPS Proxy
	const httpsProxy = (async () => {
		const proxy = await ses.resolveProxy('https://' + resolveProxyUrl);
		let httpsString = '';
		if (proxy !== 'DIRECT' || proxy.includes('HTTPS')) {
			// In case of proxy HTTPS url:port, windows gives first word as HTTPS while linux gives PROXY
			// for all other HTTP or direct url:port both uses PROXY
			if (proxy.includes('PROXY') || proxy.includes('HTTPS')) {
				httpsString += 'https=' + proxy.split('PROXY')[1] + ';';
			}
		}

		return httpsString;
	})();

	// Check FTP Proxy
	const ftpProxy = (async () => {
		const proxy = await ses.resolveProxy('ftp://' + resolveProxyUrl);
		let ftpString = '';
		if (proxy !== 'DIRECT') {
			if (proxy.includes('PROXY')) {
				ftpString += 'ftp=' + proxy.split('PROXY')[1] + ';';
			}
		}

		return ftpString;
	})();

	// Check SOCKS Proxy
	const socksProxy = (async () => {
		const proxy = await ses.resolveProxy('socks4://' + resolveProxyUrl);
		let socksString = '';
		if (proxy !== 'DIRECT') {
			if (proxy.includes('SOCKS5')) {
				socksString += 'socks=' + proxy.split('SOCKS5')[1] + ';';
			} else if (proxy.includes('SOCKS4')) {
				socksString += 'socks=' + proxy.split('SOCKS4')[1] + ';';
			} else if (proxy.includes('PROXY')) {
				socksString += 'socks=' + proxy.split('PROXY')[1] + ';';
			}
		}

		return socksString;
	})();

	const values = await Promise.all([httpProxy, httpsProxy, ftpProxy, socksProxy]);
	let proxyString = '';
	values.forEach(proxy => {
		proxyString += proxy;
	});
	ConfigUtil.setConfigItem('systemProxyRules', proxyString);
	const useSystemProxy = ConfigUtil.getConfigItem('useSystemProxy');
	if (useSystemProxy) {
		ConfigUtil.setConfigItem('proxyRules', proxyString);
	}
}
