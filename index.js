const mongoose = require('mongoose')
const { Telegraf, Markup } = require('telegraf')
const I18n = require('telegraf-i18n')

const bot = new Telegraf('6411368960:AAEFBPQX2lNk3n1IAmWQ3iDh0RywNBGAPD0')

const i18n = new I18n({
	directory: __dirname + '/locales',
	defaultLanguage: 'ru',
	sessionName: 'session',
	useSession: true,
	allowMissing: false,
})

mongoose.connect(
	'mongodb+srv://flaer:G0j9aE3FPQvJaFrN@cluster0.koyjbvu.mongodb.net/?retryWrites=true&w=majority',
	{
		useNewUrlParser: true,
		useUnifiedTopology: true,
	}
)

const db = mongoose.connection
db.on('error', console.error.bind(console, 'Ошибка подключения к MongoDB:'))
db.once('open', () => {
	console.log('Подключено к MongoDB!')
})

const userStatsSchema = new mongoose.Schema({
	userId: { type: Number, unique: true },
	username: String,
})

const UserStats = mongoose.model('UserStats', userStatsSchema)

const url = ctx => `https://t.me/FastRefBot?start=${ctx.message.from.id}`

bot.use(i18n.middleware())

bot.start(async ctx => {
	const userId = ctx.from.id
	const username = ctx.from.username

	try {
		// Проверяем, существует ли пользователь в статистике
		const existingUser = await UserStats.findOne({ userId: userId })

		// Если пользователь не найден, создаем новую запись
		if (!existingUser) {
			const newUser = new UserStats({
				userId: userId,
				username: username,
			})

			// Сохраняем нового пользователя в базе данных
			await newUser.save()

			console.log('New user added to statistics')
		}
	} catch (error) {
		console.error('Error updating user statistics:', error)
	}
	ctx.reply(
		'Select Language:',
		Markup.keyboard([['🇷🇺 Русский', '🇺🇿 Oʻzbekcha']])
			.oneTime()
			.resize()
	)
})

function handleLanguage(ctx, locale) {
	ctx.i18n.locale(locale)

	const username = ctx.message.from.first_name
	const user_id = ctx.message.from.id
	//Приветствие
	ctx.replyWithHTML(
		ctx.i18n.t('hello', { username }),
		Markup.keyboard([
			[ctx.i18n.t('Main_buttons.earn'), ctx.i18n.t('Main_buttons.profile')],
			[ctx.i18n.t('Main_buttons.withdraw'), ctx.i18n.t('Main_buttons.state')],
		])
			.oneTime()
			.resize()
	)
	//Заработать
	bot.hears(ctx.i18n.t('Main_buttons.earn'), () => {
		const refUrl = url(ctx)
		ctx.replyWithHTML(
			ctx.i18n.t('Earn.content', { refUrl }),
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
	bot.hears(ctx.i18n.t('Main_buttons.profile'), () => {
		ctx.replyWithHTML(
			ctx.i18n.t('Profile.content', { username, user_id }),
			Markup.inlineKeyboard([
				[Markup.button.callback(ctx.i18n.t('Profile.withdraw'), 'withdraw')],
			])
		)
	})
	//Вывести
	const withdrawContent = () => {
		ctx.replyWithHTML(
			ctx.i18n.t('Withdraw.content'),
			Markup.inlineKeyboard([
				[
					Markup.button.callback(
						ctx.i18n.t('Withdraw.card'),
						'withdrawCallback'
					),
					Markup.button.callback(
						ctx.i18n.t('Withdraw.visa'),
						'withdrawCallback'
					),
				],
				[
					Markup.button.callback(
						ctx.i18n.t('Withdraw.click_wallet'),
						'withdrawCallback'
					),
				],
			])
				.oneTime()
				.resize()
		)
	}
	bot.action('withdraw', () => withdrawContent())
	bot.hears(ctx.i18n.t('Main_buttons.withdraw'), () => withdrawContent())
	bot.action('withdrawCallback', () =>
		ctx.replyWithHTML(ctx.i18n.t('Withdraw.callback'))
	)
	//Статистика
	bot.hears(ctx.i18n.t('Main_buttons.state'), async () => {
		try {
			const totalUsers = await UserStats.countDocuments()
			ctx.replyWithHTML(
				ctx.i18n.t('State.content', { totalUsers }),
				Markup.inlineKeyboard([
					[Markup.button.url(ctx.i18n.t('State.admin'), 't.me/zasa_diey1')],
				])
			)
		} catch (error) {
			console.error('Error fetching statistics:', error)
			ctx.reply('Произошла ошибка при получении статистики.')
		}
	})
}
//Смена языков
bot.hears('🇷🇺 Русский', ctx => handleLanguage(ctx, 'ru'))
bot.hears('🇺🇿 Oʻzbekcha', ctx => handleLanguage(ctx, 'uz'))

bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
