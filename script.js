const curMaskVersion = 3; //当前的掩码设置版本，用于检测是否更新

//↓Code from https://github.com/OneDrive/samples/tree/master/samples/file-picking/javascript-basic-consumer
const baseUrl = "https://onedrive.live.com/picker";

// the options we pass to the picker page through the querystring
const params = {
	sdk: "8.0",
	entry: {
		oneDrive: {
			files: {},
		}
	},
	authentication: {},
	messaging: {
		origin: location.toString(),
		channelId: "27"
	},
	typesAndSources: {
		mode: "files",
		pivots: {
			oneDrive: true,
			recent: true,
		},
	},
	selection: {
	  mode: "multiple",
	  enablePersistence: true,
	},
};

let win = null;
let port = null;

async function launchPicker(e) {

	e.preventDefault();

	win = window.open("", "Picker", "width=800,height=600")

	const authToken = await getToken();

	const queryString = new URLSearchParams({
		filePicker: JSON.stringify(params),
	});

	const url = `${baseUrl}?${queryString}`;

	const form = win.document.createElement("form");
	form.setAttribute("action", url);
	form.setAttribute("method", "POST");
	win.document.body.append(form);

	const input = win.document.createElement("input");
	input.setAttribute("type", "hidden")
	input.setAttribute("name", "access_token");
	input.setAttribute("value", authToken);
	form.appendChild(input);

	form.submit();

	window.addEventListener("message", (event) => {

		if (event.source && event.source === win) {

			const message = event.data;

			if (message.type === "initialize" && message.channelId === params.messaging.channelId) {

				port = event.ports[0];

				port.addEventListener("message", messageListener);

				port.start();

				port.postMessage({
					type: "activate",
				});
			}
		}
	});
}

async function messageListener(message) {
	switch (message.data.type) {

		case "notification":
			console.log(`notification: %o`, message.data);
			break;

		case "command":

			port.postMessage({
				type: "acknowledge",
				id: message.data.id,
			});

			const command = message.data.data;

			switch (command.command) {

				case "authenticate":

					// getToken is from scripts/auth.js
					const token = await getToken();

					if (typeof token !== "undefined" && token !== null) {

						port.postMessage({
							type: "result",
							id: message.data.id,
							data: {
								result: "token",
								token,
							}
						});

					} else {
						console.error(`Could not get auth token for command: ${JSON.stringify(command)}`);
					}

					break;

				case "close":

					win.close();
					break;

				case "pick":

					console.log(`Picked: %o`, command);

					redata = command.items; //存入全局数组
					console.log("本次返回 %d 个文件，数据为 %o",
						redata.length,
						redata
					);
					generate_output(redata);

					port.postMessage({
						type: "result",
						id: message.data.id,
						data: {
							result: "success",
						},
					});

					win.close();

					break;

				default:

					console.warn(`Unsupported command: ${JSON.stringify(command)}`, 2);

					port.postMessage({
						result: "error",
						error: {
							code: "unsupportedCommand",
							message: command.command
						},
						isExpected: true,
					});
					break;
			}

			break;
	}
}
//↑Code from OneDrive/samples

class maskObj
{
	name = '';
	content = '';
	constructor(name,content) //一个掩码对象
	{
		this.name = name;
		this.content = content;
	};
}

const masks = []; //储存掩码数组
let mask_list = null; //掩码列表框
let mask_name = null;
let mask_content = null;
let outinfo = null;
let outcontent = null;

function mask_add()
{
	if (mask_name.value.length>0 && mask_content.value.length>0)
	{
		addNewMask(mask_name.value,mask_content.value);
		mask_name.value = "";
		mask_content.value = "";
	}else
	{
		alert("掩码名或内容为空");
	}
	mask_list.selectedIndex = mask_list.options.length - 1;
	save_mask_local();
}
//从文本添加一个新的掩码
function addNewMask(name,content)
{
	const mask = new maskObj(name,content);
	masks.push(mask);
	const opt = new Option(name + " : " + content, content);
	mask_list.options.add(opt);
}
function mask_remove()
{
	if(mask_list.selectedIndex>=0)
	{
		let lastSelectedIndex = mask_list.selectedIndex;
		masks.splice(mask_list.selectedIndex, 1);
		mask_list.remove(mask_list.selectedIndex);
		mask_list.selectedIndex = (lastSelectedIndex<mask_list.options.length) ?
									lastSelectedIndex :
									(mask_list.options.length-1);
	}else
	{
		alert("没有选中掩码");
	}
	save_mask_local();
}
function mask_select()
{
	mask_name.value = masks[mask_list.selectedIndex].name;
	mask_content.value = masks[mask_list.selectedIndex].content;
	if (redata) generate_output(redata); //重新生成
	localStorage.setItem("godl-mask-index",mask_list.selectedIndex);
}
function save_mask_local() //把掩码设置保存到本地
{
	const maskstr = JSON.stringify(masks);
	localStorage.setItem("godl-masks",maskstr);
	localStorage.setItem("godl-mask-index",mask_list.selectedIndex);
}
function load_mask_local() //从空白加载设置
{
	const masksCfg = ((maskStr)=>{
		try {
			return JSON.parse(maskStr);
		} catch (e) {
			return null;
		}
	})(localStorage.getItem("godl-masks"));
	
	if (!Array.isArray(masksCfg) ||
		((parseInt(localStorage.getItem("new-mask-version"),10) || 1) < curMaskVersion)
	) //没有掩码数据，初始化默认配置。
	{
		addNewMask("普通外链","http://storage.live.com/items/${file.id}:/${file.name}");
		addNewMask("最短链接","http://storage.live.com/items/${file.id}");
		addNewMask("UBB代码外链图片","[img]http://storage.live.com/items/${file.id}:/${file.name}[/img]");
		addNewMask("模板字符串基本使用示例","在OneDrive里查看 ${file.name} 的地址是：${file.webUrl}");
		addNewMask("表达式使用示例","${index+1}号文件的尺寸是：${file.size>1024?Math.round(file.size/1024)+\"K\":file.size}B");
		addNewMask("自动选择img/mp3 UBB代码","[${file.image?\"img\":(file.audio?\"mp3\":\"file\")}]http://storage.live.com/items/${file.id}:/${file.name}[/${file.image?\"img\":(file.audio?\"mp3\":\"file\")}]");
		addNewMask("ES6完整文件尺寸换算示例","${index+1}号文件的尺寸是：${(size=>{const bArr = [\"B\",\"KiB\",\"MiB\",\"GiB\",\"TiB\"];for(let idx=0;idx<bArr.length;idx++){if(idx<bArr.length && size/Math.pow(1024,idx+1)>1)continue;else return (size/Math.pow(1024,idx)).toFixed(2) + \" \" + bArr[idx];}})(file.size)}");

		if (Array.isArray(masksCfg))
		{addNewMask("▲以上为版本更新，重新添加的掩码示例","");}
		localStorage.setItem("new-mask-version",curMaskVersion);
	}else
	{
		masksCfg.forEach(function(item){
			addNewMask(item.name,item.content);
		});
	}

	mask_list.selectedIndex = parseInt(localStorage.getItem("godl-mask-index"), 10) || 0;
}

function generate_output(files)
{
	const mask = masks[mask_list.selectedIndex] || masks[0];
	
	outinfo.innerHTML = "共选择 " + files.length + " 个文件。"

	const outStrArr = files.map((item,index)=>
		showMask(mask.content,item,index)
	);
	outcontent.value = outStrArr.join("\n");
}

//显示掩码用
function showMask(str,file,index) {
	const newTxt = eval("`" + str +"`");
	return newTxt;
}

let redata = null;//储存返回的数据

window.onload = function() //网页加载初始化
{
	mask_list = document.querySelector(".mask-list");
	mask_name = document.querySelector(".mask-name");
	mask_content = document.querySelector(".mask-content");
	outinfo = document.querySelector(".outinfo");
	outcontent = document.querySelector(".outcontent");

	if (location.protocol !="https:" && location.hostname !="localhost" && location.hostname != "")
	{
		const goto = confirm("检测到你正在使用http模式，本应用要求使用https模式。\n是否自动跳转？");
		if (goto) {
			location.protocol = "https:";
		}
	}
	
	load_mask_local();

	document.getElementById("launchPicker").onclick = launchPicker;
}