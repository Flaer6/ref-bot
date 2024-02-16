const { Telegraf, Markup, Scenes, session } = require('telegraf')
const mongoose = require('mongoose')
const moment = require('moment')

const bot = new Telegraf('token') //токен бота

const ADMINS = [] //id админов
const refCount = 750 //стоимость за 1 реферала
const minWithdraw = 20000 //минимальный вывод
const botUrl = 'link' // юзер бота (без @)

const mainMenu = Markup.keyboard([
	['💳 Заработать', '💼 Мой кабинет'],
	['📤 Вывести деньги', '📊 Статистика'],
])
	.oneTime()
	.resize()

const backMenu = Markup.keyboard([['⏭️ Назад']])
	.oneTime()
	.resize()

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

				// Проверка, что refUserId не является null
				if (refUserId !== null) {
					ctx.telegram.sendMessage(
						refUserId,
						`👤 У вас новый реферал! Баланс пополнился на ${refCount}UZS`
					)
				}
			}

			await newUser.save()
		}
	} catch (error) {
		console.error(`Ошибка добавления пользователя: ${error}`)
	}

	ctx.replyWithHTML(
		`<b>🚀 Добро пожаловать ${ctx.message.from.first_name}!</b>`,
		mainMenu
	)
})

//Заработать
bot.hears('💳 Заработать', async ctx => {
	const userId = ctx.message.from.id
	const refUrl = `https://t.me/${botUrl}?start=${userId}`
	const user = await UserStats.findOne({ userId: userId })
	await ctx.replyWithHTML(
		`<b>🚀 Реферальная программа</b>\n➖➖➖➖➖➖➖➖➖➖➖➖➖\n<b>💵 Мы платим:</b>\n1 Реферал - ${refCount}UZS\n\n<b>👤 Ваши приглашённые:</b>\n${user.referralCount} партнёров\n\n<b>🔗 Ваша партнёрская ссылка:</b>\n<code>${refUrl}</code>`,
		Markup.inlineKeyboard([
			[
				Markup.button.url(
					'♻️ Поделиться ссылкой',
					`https://t.me/share/url/?url=Привет! 👋 Добро пожаловать в нашего реферального бота! 🎉 Приглашай своих друзей и получай бонусы! 🎁\n ${refUrl}
					`
				),
			],
		])
	)
})

//Мой кабинет
bot.hears('💼 Мой кабинет', async ctx => {
	const userId = ctx.message.from.id
	const user = await UserStats.findOne({ userId: userId })
	const startDate = moment(user.startDate)
	const currentDate = moment()
	const daysUsed = currentDate.diff(startDate, 'days')
	await ctx.replyWithHTML(
		`
		<b>📱 Ваш кабинет:</b>\n➖➖➖➖➖➖➖➖➖\n<b>👤 Имя:</b> ${
			ctx.message.from.first_name
		}\n<b>🔑 Ваш ID:</b> <code>${userId}</code>\n<b>🕜 Дней в боте:</b> ${daysUsed}\n➖➖➖➖➖➖➖➖➖\n<b>💳 Баланс:</b>\n● Основной: <b>${
			user.referralCount * refCount - user.withDraw
		}UZS</b>\n● Заработано: <b>${
			user.referralCount * refCount
		}UZS</b>\n● Ожидается к выплате: <b>${
			user.withDraw
		}UZS</b>\n➖➖➖➖➖➖➖➖➖\n<i>Нажмите кнопку ниже, чтобы вывести деньги:</i>
		`,
		Markup.inlineKeyboard([[Markup.button.callback('📤 Вывести', 'withdraw')]])
	)
})

//Вывести
const withdrawContent = async ctx => {
	const userId = ctx.from.id
	const user = await UserStats.findOne({ userId: userId })
	await ctx.replyWithHTML(
		`
		<b>💸 Ваш баланс: ${
			user.referralCount * refCount - user.withDraw
		}UZS</b>\n<b>⭕️ Минимальная сумма для вывода: ${minWithdraw}UZS</b>\n\n<b>👇 Выберите способ вывода:</b>
		`,
		Markup.inlineKeyboard([
			[Markup.button.callback('💳 UZCARD / HUMO', 'withdrawCallback')],
		])
	)
}

const sceneWithdraw = new Scenes.WizardScene(
	'sceneWithdraw',
	ctx => {
		ctx.replyWithHTML('<b>✅ Введите номер карты/кошелька:</b>', backMenu)
		return ctx.wizard.next()
	},
	ctx => {
		if (ctx.message.text.length < 16 || !/^\d+$/.test(ctx.message.text)) {
			ctx.reply('⭕️ Введите корректный номер!')
			return
		} else {
			ctx.reply('💰 Введите сумму вывода')
			return ctx.wizard.next()
		}
	},
	async ctx => {
		const user = await UserStats.findOne({ userId: ctx.from.id })
		const withdrawalAmount = parseInt(ctx.message.text)

		if (isNaN(withdrawalAmount)) {
			ctx.reply('⭕️ Введите число')
			return
		}
		switch (true) {
			case withdrawalAmount < minWithdraw:
				ctx.replyWithHTML(`❌ Минимальная сумма для вывода ${minWithdraw} UZS`)
				break

			case withdrawalAmount > user.referralCount * refCount:
				ctx.reply('❌ У вас недостаточно средств', mainMenu)
				return ctx.scene.leave()
				break

			default:
				// Обновление суммы на вывод в базе данных
				user.withDraw = withdrawalAmount
				await user.save()
				ctx.reply('✅ Принято', mainMenu)
				return ctx.scene.leave()
		}
	}
)

const sceneSendAll = new Scenes.WizardScene(
	'sceneSendAll',
	ctx => {
		ctx.reply('Ведите текст рассылки', backMenu)
		return ctx.wizard.next()
	},
	async ctx => {
		const allUsers = await UserStats.find({}, { userId: 1 })
		for (const user of allUsers) {
			try {
				await bot.telegram.sendMessage(user.userId, ctx.message.text)
			} catch (error) {
				console.error(
					`Ошибка при отправке сообщения пользователю ${user.userId}:`,
					error.message
				)
			}
		}
		await ctx.reply('Пост был отправлен всем пользователям')
		return ctx.scene.leave()
	}
)

const stage = new Scenes.Stage([sceneWithdraw, sceneSendAll])
stage.hears('⏭️ Назад', ctx => {
	ctx.reply('💻 Меню', mainMenu)
	ctx.scene.leave()
})
bot.use(session())
bot.use(stage.middleware())

bot.hears('📤 Вывести деньги', ctx => withdrawContent(ctx))
bot.action('withdraw', ctx => withdrawContent(ctx))
bot.action('withdrawCallback', ctx => ctx.scene.enter('sceneWithdraw'))

//Статистика
bot.hears('📊 Статистика', async ctx => {
	const startDate = new Date('2023-12-25')
	const currentDate = new Date()
	const daysWorked = Math.floor(
		(currentDate - startDate) / (24 * 60 * 60 * 1000)
	)
	try {
		ctx.replyWithHTML(
			`
			<b>📊 Статистика нашего бота:</b>\n➖➖➖➖➖➖➖➖➖➖\n<b>⏳ Старт проекта:</b> ${startDate.toLocaleDateString()}\n<b>🕜 Работаем дней:</b> ${daysWorked}\n<b>👨 Всего пользователей:</b> ${
				(await UserStats.countDocuments()) + 3500
			}
			`,
			Markup.inlineKeyboard([
				[Markup.button.url('👨‍💻 Администратор', 't.me/zasa_diey1')],
			])
		)
	} catch (error) {
		console.error(`Ошибка статистики: ${error}`)
		ctx.reply('Произошла ошибка при получении статистики :(')
	}
})

//Админка
bot.command('admin', ctx => {
	if (ADMINS.includes(ctx.from.id)) {
		ctx.reply(
			'Меню админа:',
			Markup.inlineKeyboard([[Markup.button.callback('Рассылка', 'sendAll')]])
		)
	}
})
bot.action('sendAll', ctx => ctx.scene.enter('sceneSendAll'))

bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
