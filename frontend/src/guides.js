// Human-review Guide copy and sources before release and at least every six
// months. Update each reviewed date only after its content has been checked.
export const guides = [
  {
    id: 'budgeting-basics',
    title: 'Budgeting basics',
    summary:
      'A budget helps you understand what money is coming in, what needs to go out, and what is left for everything else.',
    reviewed: '7 November 2026',
    sections: [
      {
        heading: 'Start with your income',
        paragraphs: [
          'Add up the money you expect to receive during the month. This might include wages from a job, money from family, and any other regular payments.',
          'If your income changes from month to month, plan around a cautious amount rather than your best month. You can revise the budget when you know you will receive more.',
        ],
      },
      {
        heading: 'Cover essentials first',
        paragraphs: [
          'List costs such as rent, bills, food, transport, and your phone before deciding what is available for flexible spending. Include less frequent costs by breaking them into a monthly amount.',
          'When you set a monthly spending limit in Pennies, Left to spend is that limit minus your spending so far. A negative value means you have overspent; it is not the same as all the cash remaining in your account.',
        ],
      },
      {
        heading: 'Leave room for a buffer',
        paragraphs: [
          'A small amount set aside for unexpected costs can make a budget easier to keep. Start with an achievable amount rather than waiting until you can save a large sum.',
          'If your outgoings are higher than your income, do not ignore the gap. Review flexible costs and seek free, impartial help early if you are struggling with essential payments or debt.',
        ],
      },
      {
        heading: 'A budget example',
        paragraphs: [
          'This example is illustrative, not a claim about typical income or costs. Imagine you receive £900 and earn £300 from part-time work in a month.',
        ],
        bullets: [
          'Income: £1,200',
          'Rent and bills: £650',
          'Food, transport, and phone: £250',
          'Buffer: £50',
          'Left for flexible spending: £250',
        ],
      },
      {
        heading: 'Review and adjust',
        paragraphs: [
          'Compare your plan with your actual spending regularly. A budget is useful when it reflects your real circumstances, not when it follows somebody else’s percentages perfectly.',
        ],
      },
    ],
    takeaways: [
      'Use realistic income and include less frequent costs.',
      'Cover essentials before flexible spending.',
      'Build a small buffer and adjust the budget when circumstances change.',
    ],
    sources: [
      {
        label: 'MoneyHelper: Managing your money — a beginner’s guide',
        url: 'https://www.moneyhelper.org.uk/en/everyday-money/budgeting/beginners-guide-to-managing-your-money',
      },
      {
        label: 'MoneyHelper: Budget planner',
        url: 'https://www.moneyhelper.org.uk/en/everyday-money/budgeting/budget-planner',
      },
      {
        label: 'MoneyHelper: How to budget',
        url: 'https://www.moneyhelper.org.uk/en/everyday-money/budgeting',
      },
    ],
  },
  {
    id: 'scam-avoidance',
    title: 'Scam avoidance',
    summary:
      'Knowing the tactics scammers use can help you pause, check who you are dealing with, and protect your money and accounts.',
    reviewed: '7 November 2026',
    sections: [
      {
        heading: 'Pause when someone creates pressure',
        paragraphs: [
          'Unexpected contact, urgent deadlines, secrecy, emotional pressure, and offers that seem too good to be true are warning signs. A message appearing to come from a friend, bank, or well-known company does not prove it is genuine.',
          'Stop and check through a route you trust. Use the organisation’s official website or a known phone number rather than links or contact details supplied in the message.',
        ],
      },
      {
        heading: 'Scams to watch for',
        paragraphs: [
          'Phishing messages may ask for login or banking details. Impersonation scams may claim to be your bank, a landlord, a delivery company, or someone offering a job. Investment scams often promise guaranteed or unusually high returns and use social media or fear of missing out.',
        ],
        bullets: [
          'Be suspicious of requests for one-time passcodes, full PINs, or passwords.',
          'Check requests for transfers, gift cards, or cryptocurrency independently.',
          'Do not let an unexpected caller install remote-access software.',
          'Be cautious if someone asks you to move away from an official payment platform.',
        ],
      },
      {
        heading: 'Check before you pay or invest',
        paragraphs: [
          'Use the FCA Firm Checker when a financial service should be authorised or registered. Scammers can clone genuine firms, so check the exact contact details and permissions rather than relying on a familiar name or logo.',
          'No check makes an investment safe, and authorisation does not guarantee protection for every activity. If you do not understand the offer, do not rush into it.',
        ],
      },
      {
        heading: 'If you have responded or sent money',
        paragraphs: [
          'You are not to blame for being targeted. Act quickly, even if you feel embarrassed or are not sure whether it was a scam.',
        ],
        bullets: [
          'Stop contact and do not send more money, including to someone offering to recover your loss.',
          'If money was taken or someone may have account access, contact your bank immediately using a trusted number or its official app or website.',
          'Change passwords that you disclosed, especially anywhere you reused them.',
          'Keep messages, receipts, account details, and other evidence.',
          'Call 999 if anyone is in immediate danger.',
        ],
      },
      {
        heading: 'Report it',
        paragraphs: [
          'Reporting is separate from contacting your bank. In England and Wales, report fraud to Report Fraud online or by calling 0300 123 2040. In Scotland, contact Police Scotland, normally on 101. In Northern Ireland, use Report Fraud online or follow the official PSNI and nidirect guidance to decide whether a PSNI 101 call is needed.',
          'Across the UK, suspicious emails can be forwarded to report@phishing.gov.uk and suspicious texts to 7726. Forwarding a suspicious message is not the same as reporting a crime.',
        ],
      },
    ],
    takeaways: [
      'Pressure, secrecy, and unexpected requests are reasons to pause and check.',
      'Use trusted contact details, not those in an unexpected message.',
      'Contact your bank immediately if money or account access is involved.',
    ],
    sources: [
      {
        label: 'FCA: Protect yourself from scams',
        url: 'https://www.fca.org.uk/consumers/protect-yourself-scams',
      },
      {
        label: 'FCA Firm Checker',
        url: 'https://www.fca.org.uk/consumers/fca-firm-checker',
      },
      {
        label: 'Stop! Think Fraud: Reporting fraud',
        url: 'https://stopthinkfraud.campaign.gov.uk/reporting-fraud/',
      },
      {
        label: 'NCSC: Phishing scams — how to spot and report them',
        url: 'https://www.ncsc.gov.uk/collection/phishing-scams',
      },
      {
        label: 'Police Scotland: How to report a crime',
        url: 'https://www.scotland.police.uk/contact-us/how-to-report-a-crime',
      },
      {
        label: 'nidirect: Reporting a scam',
        url: 'https://www.nidirect.gov.uk/articles/reporting-scam',
      },
    ],
  },
  {
    id: 'investing-basics',
    title: 'Investing basics',
    summary:
      'Investing can support long-term goals such as retirement or buying a first home by giving your money an opportunity to grow. It is a long-term approach, not a way to get rich quickly.',
    reviewed: '7 November 2026',
    disclaimer:
      'This Guide provides general information, not personalised financial advice. Investments can fall as well as rise, and returns are never guaranteed.',
    sections: [
      {
        heading: 'What investing can help with',
        paragraphs: [
          'Investing can help you work towards long-term goals such as retirement or a first home deposit. It gives money the potential to grow over time and help keep up with rising prices.',
          'The goal matters: money you expect to need soon generally belongs in cash savings, while money you can leave untouched for several years may be suitable for investing.',
        ],
      },
      {
        heading: 'Check whether investing is right for you now',
        paragraphs: [
          'Before investing, cover essential costs, build accessible emergency savings, and consider any expensive debts. Investing works best when you can leave the money untouched rather than needing it for day-to-day expenses.',
        ],
      },
      {
        heading: 'Cash savings and investing are different',
        paragraphs: [
          'Cash savings are useful for short-term needs and usually pay interest. Investing means buying assets such as shares or bonds with the potential for greater long-term growth, although their value will move up and down.',
        ],
      },
      {
        heading: 'Spread the risk',
        paragraphs: [
          'Diversification means spreading money across different companies, sectors, asset types, and regions so you do not depend on one investment.',
          'A pooled fund combines money from many investors to hold a collection of investments. This can be a practical way to diversify with a small amount; compare what each fund holds and what it charges.',
        ],
      },
      {
        heading: 'Small amounts can build a habit',
        paragraphs: [
          'Some services allow regular monthly investing rather than a lump sum. This can make a long-term goal feel more manageable and create a consistent saving habit.',
          'Fees reduce your returns, so compare total costs and check when you can access your money before choosing a service.',
        ],
      },
      {
        heading: 'Think in years, not days',
        paragraphs: [
          'Investing normally means taking a long-term view—at least five years—rather than reacting to every price movement. Staying invested through market ups and downs is generally more sensible than trying to predict the perfect time to buy and sell.',
          'Reinvesting returns can also create compounding: potential growth on top of earlier growth. Starting with time on your side can be valuable, but your goals, need for access, and ability to cope with losses still matter.',
        ],
      },
      {
        heading: 'Age and ISAs',
        paragraphs: [
          'You must generally be 18 or over to open an adult ISA, alongside residence and other eligibility rules. A parent or guardian with parental responsibility opens and initially manages a Junior ISA for a child under 18; the money belongs to the child.',
          'An ISA is a tax wrapper, not an investment by itself. Cash and stocks-and-shares versions have different risks and purposes.',
        ],
      },
      {
        heading: 'Do not invest because of hype',
        paragraphs: [
          'Social-media posts, influencers, friends, and rapidly rising prices can create fear of missing out. Pause, consider what the promoter gains, check independent sources, and never treat past performance or a celebrity endorsement as evidence of future returns.',
        ],
      },
    ],
    takeaways: [
      'Match investing to long-term goals such as retirement or a first home deposit.',
      'Regular small amounts and diversified funds can make getting started more manageable.',
      'Give investments time, keep costs low, and make sure you can leave the money untouched.',
    ],
    sources: [
      {
        label: 'FCA: The golden rules of investing',
        url: 'https://www.fca.org.uk/investsmart/golden-rules-investing',
      },
      {
        label: 'FCA: 5 smart investment checks',
        url: 'https://www.fca.org.uk/investsmart/5-smart-investment-checks',
      },
      {
        label: 'FCA: Diversification',
        url: 'https://www.fca.org.uk/investsmart/diversification',
      },
      {
        label: 'FCA: Risk and returns',
        url: 'https://www.fca.org.uk/investsmart/risk-returns',
      },
      {
        label: 'FCA: Hype — spot the signs and manage your FOMO',
        url: 'https://www.fca.org.uk/investsmart/hype-spot-signs-manage-your-fomo',
      },
      {
        label: 'GOV.UK: Individual Savings Accounts',
        url: 'https://www.gov.uk/individual-savings-accounts',
      },
      {
        label: 'GOV.UK: Junior Individual Savings Accounts',
        url: 'https://www.gov.uk/junior-individual-savings-accounts',
      },
    ],
  },
]
