const { Telegraf, Markup, session } = require('telegraf')
const I18n = require('telegraf-i18n')

const bot = new Telegraf('6411368960:AAEFBPQX2lNk3n1IAmWQ3iDh0RywNBGAPD0')

const i18n = new I18n({
	directory: __dirname + '/locales',
	defaultLanguage: 'ru',
	sessionName: 'session',
	useSession: true,
	allowMissing: false,
})
const url = ctx => `https://t.me/FastRefBot?start=${ctx.message.from.id}`

bot.use(i18n.middleware())

bot.start(ctx => {
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
			[ctx.i18n.t('Main_buttons.withdraw')],
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
}
//Смена языков
bot.hears('🇷🇺 Русский', ctx => handleLanguage(ctx, 'ru'))
bot.hears('🇺🇿 Oʻzbekcha', ctx => handleLanguage(ctx, 'uz'))

bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
