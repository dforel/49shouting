
const path = require('path')
const { buildArgs } = require('../utils/util')
const { default: PQueue } = require('p-queue');
var https=require("https");

exports.command = 'unicom'

exports.describe = 'unicom任务'

function dateFormat(fmt, date) {
    let ret;
    const opt = {
        "Y+": date.getFullYear().toString(),        // 年
        "m+": (date.getMonth() + 1).toString(),     // 月
        "d+": date.getDate().toString(),            // 日
        "H+": date.getHours().toString(),           // 时
        "M+": date.getMinutes().toString(),         // 分
        "S+": date.getSeconds().toString()          // 秒
        // 有其他格式化字符需求可以继续添加，必须转化成字符串
    };
    for (let k in opt) {
        ret = new RegExp("(" + k + ")").exec(fmt);
        if (ret) {
            fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
        };
    };
    return fmt;
}

exports.builder = function (yargs) {
  return yargs
    .option('user', {
      describe: '用于登录的手机号码',
      default: '',
      type: 'string'
    })
    .option('password', {
      describe: '用于登录的账户密码',
      default: '',
      type: 'string'
    })
    .option('appid', {
      describe: 'appid',
      default: '',
      type: 'string'
    })
    .option('cookies', {
      describe: '签到cookies',
      default: '',
      type: 'string'
    })
    .help()
    .showHelpOnFail(true, '使用--help查看有效选项')
    .epilog('copyright 2020 LunnLew');
}

exports.handler = async function (argv) {
  var command = argv._[0]
  let accounts = buildArgs(argv)
  console.info('总账户数', accounts.length)
  console.info('参数', argv)
  let concurrency = 1
  let queue = new PQueue({ concurrency });
  for (let account of accounts) {
    queue.add(async () => {
      let { scheduler } = require('../utils/scheduler')
      await require(path.join(__dirname, 'tasks', command, command)).start({
        cookies: account.cookies,
        options: account
      }).catch(err => console.info("unicom任务:", err))
      let hasTasks = await scheduler.hasWillTask(command, {
        tryrun: 'tryrun' in argv,
        taskKey: account.user,
        tasks: account.tasks
      })
      if (hasTasks) {
        await scheduler.execTask(command, account.tasks).catch(err => console.error("unicom任务:", err)).finally(() => {
          
          if (Object.prototype.toString.call(scheduler.taskJson.rewards) === '[object Object]') {
            console.info('今日获得奖品信息统计') 
            let content = "今日获得奖品信息统计"
            let title = "今日获得奖品信息统计"
            for (let type in scheduler.taskJson.rewards) {
              console.info(`\t`, type, scheduler.taskJson.rewards[type])
              content+="\t"+type+"\t"+scheduler.taskJson.rewards[type]+"\r\n"
            } 
            https.get("http://sc.ftqq.com/SCU68781Tee5b77950beb32c5278986f92a9664cd5df47e99e2d52.send?text=今日获得奖品信息统计"+dateFormat("YYYY-mm-dd HH:MM", new Date())+"&desp="+content,function(data){
                var str="";
                data.on("data",function(chunk){
                    str+=chunk;//监听数据响应，拼接数据片段
                })
                data.on("end",function(){
                    console.log(str.toString())
                })
            })
          }
          
          console.info('当前任务执行完毕！')
        })
      } else {
        console.info('暂无可执行任务！')
      }
    })
  }
  await queue.onIdle()
}
