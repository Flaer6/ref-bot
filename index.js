const { Telegraf, Markup, Scenes, session } = require('telegraf')
const mongoose = require('mongoose')
const I18n = require('telegraf-i18n')
const { match } = require('telegraf-i18n')
const moment = require('moment')

const bot = new Telegraf('6411368960:AAEFBPQX2lNk3n1IAmWQ3iDh0RywNBGAPD0')
const i18n = new I18n({
	directory: __dirname + '/locales',
	defaultLanguage: 'ru',
	sessionName: 'session',
	useSession: true,
	allowMissing: false,
})

const refCount = 1000 //стоимость за 1 реферала
const minWithdraw = 20000 //минимальный вывод

mongoose.connect(
	'mongodb+srv://ahaevviktor896:jIolaH5ki6Lrb8Yl@cluster0.fryapue.mongodb.net/?retryWrites=true&w=majority',
	{
		serverSelectionTimeoutMS: 5000,
	}
)
const db = mongoose.connection
db.on('error', console.error.bind(console, 'Ошибка подключения к MongoDB:'))
db.once('open', () => {
	console.log('Подключено к MongoDB!')
})

const UserStats = mongoose.model('UserStats', {
	userId: { type: Number, unique: true },
	username: String,
	refUserId: { type: Number, default: null },
	referralCount: { type: Number, default: 0 },
	withDraw: { type: Number, default: 0 },
	startDate: { type: Date, default: Date.now },
})

bot.use(i18n.middleware())

bot.start(async ctx => {
	const username = ctx.message.from.first_name
	const userId = ctx.message.from.id
	const refUserId = parseInt(ctx.message.text.split(' ')[1])
	try {
		const existingUser = await UserStats.findOne({ userId: userId })
		if (!existingUser) {
			const newUser = new UserStats({
				userId: userId,
				username: username,
				refUserId: !isNaN(refUserId) ? refUserId : null,
			})
			if (!isNaN(refUserId)) {
				await UserStats.updateOne(
					{ userId: refUserId },
					{ $inc: { referralCount: 1 } }
				)
				ctx.replyWithHTML(ctx.i18n.t('invited', { refUserId }))
			}
			await newUser.save()
			ctx.telegram.sendMessage(
				refUserId,
				ctx.i18n.t('newPartner', { refCount })
			)
		}
	} catch (error) {
		console.error(`Ошибка добавления пользователя: ${error}`)
	}
	ctx.reply(
		'Select Language:',
		Markup.keyboard([['🇷🇺 Русский', '🇺🇿 Oʻzbekcha']])
			.oneTime()
			.resize()
	)
})

//Заработать
bot.hears(match('Main_buttons.earn'), async ctx => {
	const userId = ctx.message.from.id
	const refUrl = `https://t.me/CaselokBot?start=${userId}`
	const user = await UserStats.findOne({ userId: userId })
	await ctx.replyWithHTML(
		ctx.i18n.t('Earn.content', {
			refUrl,
			refCount,
			partners: user.referralCount,
		}),
		Markup.inlineKeyboard([
			[
				Markup.button.url(
					ctx.i18n.t('Earn.share'),
					`https://t.me/share/url/?url=${ctx.i18n.t('Earn.share_text', {
						refUrl,
					})}
					`
				),
			],
		])
	)
})

//Мой кабинет
bot.hears(match('Main_buttons.profile'), async ctx => {
	const userId = ctx.message.from.id
	const user = await UserStats.findOne({ userId: userId })

	const startDate = moment(user.startDate)
	const currentDate = moment()
	const daysUsed = currentDate.diff(startDate, 'days')
	await ctx.replyWithHTML(
		ctx.i18n.t('Profile.content', {
			username: ctx.message.from.first_name,
			userId: userId,
			balance: user.referralCount * refCount,
			days: daysUsed,
			withdraw: user.withDraw,
		}),
		Markup.inlineKeyboard([
			[Markup.button.callback(ctx.i18n.t('Profile.withdraw'), 'withdraw')],
		])
	)
})

//Вывести
const withdrawContent = async ctx => {
	const userId = ctx.from.id
	const user = await UserStats.findOne({ userId: userId })
	await ctx.replyWithHTML(
		ctx.i18n.t('Withdraw.content', {
			minWithdraw,
			balance: user.referralCount * refCount,
		}),
		Markup.inlineKeyboard([
			[Markup.button.callback(ctx.i18n.t('Withdraw.card'), 'withdrawCallback')],
		])
			.oneTime()
			.resize()
	)
}

const sceneWithdraw = new Scenes.WizardScene(
	'sceneWithdraw',
	ctx => {
		ctx.replyWithHTML(ctx.i18n.t('Withdraw.callback'))
		return ctx.wizard.next()
	},
	ctx => {
		if (ctx.message.text.length < 16 || !/^\d+$/.test(ctx.message.text)) {
			ctx.reply(ctx.i18n.t('Withdraw.correctCard'))
			return
		} else {
			ctx.reply(ctx.i18n.t('Withdraw.enterSum'))
			return ctx.wizard.next()
		}
	},
	async ctx => {
		const user = await UserStats.findOne({ userId: ctx.from.id })
		const withdrawalAmount = parseInt(ctx.message.text)

		if (isNaN(withdrawalAmount)) {
			ctx.reply(ctx.i18n.t('Withdraw.enterNum'))
			return
		}
		switch (true) {
			case withdrawalAmount < minWithdraw:
				ctx.replyWithHTML(ctx.i18n.t('Withdraw.minSum', { minWithdraw }))
				break

			case withdrawalAmount > user.referralCount * refCount:
				ctx.reply(ctx.i18n.t('Withdraw.noMoney'))
				break

			default:
				// Обновление суммы на вывод в базе данных
				user.withDraw = withdrawalAmount
				await user.save()
				ctx.reply(ctx.i18n.t('Withdraw.accepted'))
				return ctx.scene.leave()
		}
	}
)

const stage = new Scenes.Stage([sceneWithdraw])
bot.use(session())
bot.use(stage.middleware())

bot.hears(match('Main_buttons.withdraw'), withdrawContent)
bot.action('withdraw', ctx => withdrawContent(ctx))
bot.action('withdrawCallback', ctx => ctx.scene.enter('sceneWithdraw'))

//Статистика
bot.hears(match('Main_buttons.state'), async ctx => {
	const startDate = new Date('2023-12-25')
	const currentDate = new Date()
	const daysWorked = Math.floor(
		(currentDate - startDate) / (24 * 60 * 60 * 1000)
	)
	try {
		ctx.replyWithHTML(
			ctx.i18n.t('State.content', {
				totalUsers: await UserStats.countDocuments(),
				startDate: startDate.toLocaleDateString(),
				daysWorked,
			}),
			Markup.inlineKeyboard([
				[Markup.button.url(ctx.i18n.t('State.admin'), 't.me/zasa_diey1')],
			])
		)
	} catch (error) {
		console.error(`Ошибка статистики: ${error}`)
		ctx.reply(ctx.i18n.t('State.error'))
	}
})

function handleLanguage(lang) {
	return ctx => {
		ctx.i18n.locale(lang)

		const username = ctx.message.from.first_name
		//Приветствие
		ctx.replyWithHTML(
			ctx.i18n.t('hello', {
				username: ctx.message.from.first_name,
			}),
			Markup.keyboard([
				[ctx.i18n.t('Main_buttons.earn'), ctx.i18n.t('Main_buttons.profile')],
				[ctx.i18n.t('Main_buttons.withdraw'), ctx.i18n.t('Main_buttons.state')],
			])
				.oneTime()
				.resize()
		)
	}
}

//Смена языков
bot.hears('🇷🇺 Русский', handleLanguage('ru'))
bot.hears('🇺🇿 Oʻzbekcha', handleLanguage('uz'))

bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
