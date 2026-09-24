# -*- coding: utf-8 -*-
"""
Constructors, their lineage chains, and engine/power-unit manufacturers.

CONSTRUCTORS tuple order:
 id, name, full_name, country, base, first_entry, last_entry, wins,
 constructors_titles, drivers_titles, title_years, lineage_chain,
 active, notes, confidence

Win totals for long-running constructors are the figure most often
published officially and are marked 'medium' where the exact running
total moves with the current season.
"""

CONSTRUCTORS = [
    # ------------------------------------------------ current entrants
    ("ferrari", "Ferrari", "Scuderia Ferrari HP", "Italy", "Maranello, Italy", 1950, None,
     250, 16, 15, "1961,1964,1975,1976,1977,1979,1982,1983,1999,2000,2001,2002,2003,2004,2007,2008",
     "maranello", 1,
     "The only constructor to have contested every season since 1950. Fifteen drivers' titles and sixteen constructors' titles, the last in 2008. Won its first championship Grand Prix at Silverstone in 1951 with Gonzalez.", "medium"),
    ("mercedes", "Mercedes", "Mercedes-AMG PETRONAS Formula One Team", "Germany", "Brackley, United Kingdom", 1954, None,
     None, 8, 9, "2014,2015,2016,2017,2018,2019,2020,2021", "brackley", 1,
     "Two spells: a works team in 1954-55 that won two titles with Fangio and withdrew after Le Mans, and the modern operation that took over Brawn GP in 2010 and won eight consecutive constructors' championships from 2014. Registered first entry 1954; the current entity traces its entry chain through BAR and Honda.", "medium"),
    ("mclaren", "McLaren", "McLaren Mastercard F1 Team", "United Kingdom", "Woking, United Kingdom", 1966, None,
     205, 10, 14, "1974,1984,1985,1988,1989,1990,1991,1998,2024,2025", "woking", 1,
     "Founded by Bruce McLaren in 1963, first entry 1966. Second only to Ferrari in wins and titles. The MP4/4 of 1988 won 15 of 16 races. Returned to the top in 2024-25 after a 26-year constructors' drought.", "medium"),
    ("red-bull", "Red Bull Racing", "Oracle Red Bull Racing", "Austria", "Milton Keynes, United Kingdom", 2005, None,
     None, 6, 8, "2010,2011,2012,2013,2022,2023", "milton-keynes", 1,
     "Bought the Jaguar entry for a nominal sum in late 2004. Six constructors' titles and eight drivers' titles in twenty seasons. Its 2023 season — 21 wins from 22 — is the most dominant in the sport's history.", "medium"),
    ("williams", "Williams", "Atlassian Williams F1 Team", "United Kingdom", "Grove, United Kingdom", 1977, None,
     114, 9, 7, "1980,1981,1986,1987,1992,1993,1994,1996,1997", "grove", 1,
     "Frank Williams's second and lasting venture. Nine constructors' titles, all between 1980 and 1997. Sold to Dorilton Capital in 2020, ending family control.", "high"),
    ("alpine", "Alpine", "BWT Alpine Formula One Team", "France", "Enstone, United Kingdom", 2021, None,
     1, 0, 0, None, "enstone", 1,
     "The Renault works entry rebadged for 2021. One win, at the 2021 Hungarian GP with Ocon. The Enstone factory it occupies has won two constructors' titles under earlier names.", "high"),
    # first_entry is 1959, not 2021: Aston Martin entered the DBR4 and DBR5
    # as a constructor in 1959-60. Two spells under one marque is how this
    # register already treats Mercedes (1954-55 and 2010-) and Alfa Romeo
    # (1950-51 and 1979-85). Recording only the modern spell put seven
    # 1959-60 entries against a constructor whose register life began in
    # 2021, which verify.py now refuses.
    ("aston-martin", "Aston Martin", "Aston Martin Aramco Formula One Team", "United Kingdom", "Silverstone, United Kingdom", 1959, None,
     0, 0, 0, None, "silverstone", 1,
     "Two spells. Aston Martin entered the front-engined DBR4 and DBR5 in 1959-60, by which time the rear-engined Coopers had made them obsolete; the marque scored no points. The current entity is unrelated, dating from Lawrence Stroll's 2021 rebrand of Racing Point. Adrian Newey joined as team principal for 2026.", "medium"),
    ("haas", "Haas F1 Team", "TGR Haas F1 Team", "United States", "Kannapolis, United States", 2016, None,
     0, 0, 0, None, "kannapolis", 1,
     "The first American constructor since 1986, and the first to run a customer-parts model built around Ferrari supply and Dallara manufacture.", "high"),
    ("racing-bulls", "Racing Bulls", "Visa Cash App Racing Bulls Formula One Team", "Italy", "Faenza, Italy", 1985, None,
     2, 0, 0, None, "faenza", 1,
     "The Faenza entry, continuously in the championship since Minardi's 1985 debut. Two wins, both giant-killings: Vettel at Monza in 2008 and Gasly at Monza in 2020.", "high"),
    ("audi", "Audi", "Audi Revolut F1 Team", "Germany", "Hinwil, Switzerland", 2026, None,
     0, 0, 0, None, "hinwil", 1,
     "The Hinwil operation founded by Peter Sauber, taken over completely by Audi for the 2026 regulations. Audi builds its own power unit at Neuburg an der Donau — the first new works manufacturer entry since Honda's return.", "verified"),
    ("cadillac", "Cadillac", "Cadillac Formula 1 Team", "United States", "Silverstone, United Kingdom", 2026, None,
     0, 0, 0, None, "cadillac", 1,
     "The eleventh team, admitted for 2026 after a protracted approval process originally begun as the Andretti-Cadillac bid. Runs Ferrari power units pending its own General Motors unit.", "verified"),

    # ------------------------------------------- historic championship winners
    ("lotus", "Team Lotus", "Team Lotus", "United Kingdom", "Hethel, United Kingdom", 1958, 1994,
     79, 7, 6, "1963,1965,1968,1970,1972,1973,1978", "hethel", 0,
     "Colin Chapman's constructor: the monocoque chassis (Lotus 25), full ground effect (Lotus 78/79), active suspension and the first major commercial sponsorship deal. Collapsed in 1994 after Chapman's death in 1982.", "high"),
    ("brabham", "Brabham", "Motor Racing Developments (Brabham)", "United Kingdom", "Chessington, United Kingdom", 1962, 1992,
     35, 2, 4, "1966,1967", "brabham-chain", 0,
     "Founded by Jack Brabham and Ron Tauranac. Later run by Bernie Ecclestone, whose ownership was the platform for his takeover of the sport's commercial rights. The BT46B 'fan car' won its only race and was withdrawn.", "high"),
    ("tyrrell", "Tyrrell", "Tyrrell Racing Organisation", "United Kingdom", "Ockham, United Kingdom", 1970, 1998,
     23, 1, 2, "1971", "brackley", 0,
     "Ken Tyrrell's team, which built the six-wheeled P34. Sold to British American Tobacco in 1997 and became BAR.", "high"),
    ("cooper", "Cooper", "Cooper Car Company", "United Kingdom", "Surbiton, United Kingdom", 1950, 1969,
     16, 2, 2, "1959,1960", "cooper-chain", 0,
     "Put the engine behind the driver and made the front-engined Grand Prix car obsolete within three seasons.", "high"),
    ("brm", "BRM", "British Racing Motors", "United Kingdom", "Bourne, United Kingdom", 1951, 1977,
     17, 1, 1, "1962", "brm-chain", 0,
     "A national-effort project that took eleven years to win a championship. Built the extraordinary H16 engine.", "high"),
    # 1966, not 1967. The German Grand Prix that year ran Formula Two cars
    # alongside the Formula One field and classified them together: Matra
    # entered four, and Beltoise finished eighth. The F1DB results load found
    # the entries against a first_entry of 1967.
    ("matra", "Matra", "Matra Sports", "France", "Velizy, France", 1966, 1972,
     9, 1, 1, "1969", "matra-chain", 0,
     "An aerospace company that won the title at its third attempt, run in 1969 by Ken Tyrrell with Ford power. Its first championship entries were the Formula Two cars admitted to the 1966 German Grand Prix.", "high"),
    ("vanwall", "Vanwall", "Vandervell Products", "United Kingdom", "Acton, United Kingdom", 1954, 1960,
     9, 1, 0, "1958", "vanwall-chain", 0,
     "Tony Vandervell's team won the first Constructors' Championship in 1958 and withdrew almost immediately after Stuart Lewis-Evans's death.", "high"),
    ("benetton", "Benetton", "Benetton Formula", "Italy/UK", "Enstone, United Kingdom", 1986, 2001,
     27, 1, 2, "1995", "enstone", 0,
     "Bought Toleman in 1985. Michael Schumacher's first two titles came here; the team's 1994 season was dogged by technical-compliance disputes.", "high"),
    ("renault", "Renault", "Renault F1 Team", "France", "Enstone, United Kingdom", 1977, 2020,
     35, 2, 2, "2005,2006", "enstone", 0,
     "Introduced the turbocharged engine to F1 in 1977 and won two doubles with Alonso in 2005-06 after buying Benetton. Withdrew as a works entrant at the end of 2020, rebranding as Alpine.", "medium"),
    ("brawn", "Brawn GP", "Brawn GP Formula One Team", "United Kingdom", "Brackley, United Kingdom", 2009, 2009,
     8, 1, 1, "2009", "brackley", 0,
     "Ross Brawn's management buyout of Honda's abandoned team for a nominal sum. Won both championships in its only season and was sold to Mercedes.", "high"),
    ("alfa-romeo", "Alfa Romeo", "Alfa Romeo SpA", "Italy", "Milan, Italy", 1950, 1985,
     10, 0, 2, None, "alfa-chain", 0,
     "Dominated 1950-51 with the pre-war 158/159 'Alfetta' and won the first two drivers' titles, then withdrew. Returned as a constructor 1979-85 and later as a naming-rights partner to Sauber, 2019-2023.", "high"),
    ("maserati", "Maserati", "Officine Alfieri Maserati", "Italy", "Modena, Italy", 1950, 1960,
     9, 0, 1, None, "maserati-chain", 0,
     "The 250F is among the most admired Grand Prix cars ever built; Fangio took the 1957 title in one.", "high"),

    # -------------------------------------------- other race-winning teams
    ("ligier", "Ligier", "Equipe Ligier", "France", "Magny-Cours, France", 1976, 1996,
     9, 0, 0, None, "ligier-chain", 0,
     "Guy Ligier's team; sold to Alain Prost in 1997.", "medium"),
    ("jordan", "Jordan", "Jordan Grand Prix", "Ireland", "Silverstone, United Kingdom", 1991, 2005,
     4, 0, 0, None, "silverstone", 0,
     "Eddie Jordan's team gave Michael Schumacher his F1 debut at Spa in 1991 and finished third in the 1999 championship.", "high"),
    ("march", "March", "March Engineering", "United Kingdom", "Bicester, United Kingdom", 1970, 1992,
     3, 0, 0, None, "march-chain", 0,
     "A customer-car manufacturer that also ran a works entry; Peterson and Lauda both started here.", "medium"),
    ("wolf", "Walter Wolf Racing", "Walter Wolf Racing", "Canada", "Reading, United Kingdom", 1977, 1979,
     3, 0, 0, None, "wolf-chain", 0,
     "Won on its championship debut in Argentina 1977 with Scheckter — a feat matched only by Brawn GP.", "high"),
    ("hesketh", "Hesketh", "Hesketh Racing", "United Kingdom", "Towcester, United Kingdom", 1973, 1978,
     1, 0, 0, None, "hesketh-chain", 0,
     "Lord Hesketh's unsponsored team won the 1975 Dutch GP with James Hunt.", "high"),
    ("shadow", "Shadow", "Shadow Racing Cars", "United States/UK", "Northampton, United Kingdom", 1973, 1980,
     1, 0, 0, None, "shadow-chain", 0,
     "Won the 1977 Austrian GP with Alan Jones. A staff walkout founded Arrows.", "medium"),
    # last_entry is 1977, not 1976. Penske the team withdrew after 1976, but
    # the PC4 was entered through 1977 by ATS Racing and Interscope, and the
    # constructor credit for a chassis belongs to whoever built it, not
    # whoever entered it. Ten 1977 entries had nowhere to go before this.
    ("penske", "Penske", "Penske Cars", "United States", "Poole, United Kingdom", 1974, 1977,
     1, 0, 0, None, "penske-chain", 0,
     "Won the 1976 Austrian GP with John Watson, then left for American racing. The PC4 raced on into 1977 in other hands - ATS Racing and Interscope - which is why the constructor's last entry is a year after the team's.", "medium"),
    ("stewart-gp", "Stewart Grand Prix", "Stewart Grand Prix", "United Kingdom", "Milton Keynes, United Kingdom", 1997, 1999,
     1, 0, 0, None, "milton-keynes", 0,
     "Jackie and Paul Stewart's Ford-backed team won at the Nurburgring in 1999 and was sold to Ford to become Jaguar.", "high"),
    ("jaguar", "Jaguar Racing", "Jaguar Racing", "United Kingdom", "Milton Keynes, United Kingdom", 2000, 2004,
     0, 0, 0, None, "milton-keynes", 0,
     "Ford's rebadging of Stewart. Never won a race; sold to Red Bull for a nominal sum in 2004.", "high"),
    ("honda-works", "Honda", "Honda Racing F1 Team", "Japan", "Brackley, United Kingdom", 1964, 2008,
     3, 0, 0, None, "brackley", 0,
     "Two spells as a constructor: 1964-68, winning in Mexico 1965 and Monza 1967, and 2006-08 after buying BAR. Withdrew in the 2008 financial crisis, whereupon the team became Brawn GP.", "high"),
    ("bar", "British American Racing", "British American Racing", "United Kingdom", "Brackley, United Kingdom", 1999, 2005,
     0, 0, 0, None, "brackley", 0,
     "Built from the Tyrrell entry with British American Tobacco money. Second in the 2004 constructors' championship.", "high"),
    ("toro-rosso", "Scuderia Toro Rosso", "Scuderia Toro Rosso", "Italy", "Faenza, Italy", 2006, 2019,
     1, 0, 0, None, "faenza", 0,
     "Red Bull's junior team; Vettel's Monza 2008 win remains the last for a team using a customer chassis philosophy of that kind.", "high"),
    ("alphatauri", "Scuderia AlphaTauri", "Scuderia AlphaTauri", "Italy", "Faenza, Italy", 2020, 2023,
     1, 0, 0, None, "faenza", 0,
     "The Faenza team rebranded to promote Red Bull's fashion label. Gasly won at Monza in 2020.", "high"),
    ("force-india", "Force India", "Sahara Force India F1 Team", "India", "Silverstone, United Kingdom", 2008, 2018,
     0, 0, 0, None, "silverstone", 0,
     "Vijay Mallya's team took pole and a podium at Spa in 2009 and finished fourth in 2016 and 2017 before going into administration.", "high"),
    ("racing-point", "Racing Point", "BWT Racing Point F1 Team", "United Kingdom", "Silverstone, United Kingdom", 2019, 2020,
     1, 0, 0, None, "silverstone", 0,
     "Won the 2020 Sakhir GP with Perez. Penalised that year for copying Mercedes brake ducts — the 'pink Mercedes' affair.", "high"),
    ("sauber", "Sauber", "Sauber F1 Team", "Switzerland", "Hinwil, Switzerland", 1993, 2025,
     1, 0, 0, None, "hinwil", 0,
     "Peter Sauber's independent team. Its single win came as BMW Sauber with Kubica in Canada 2008. Ran as Alfa Romeo 2019-23 and Kick Sauber 2024-25 before becoming Audi.", "high"),
    ("bmw-sauber", "BMW Sauber", "BMW Sauber F1 Team", "Germany/Switzerland", "Hinwil, Switzerland", 2006, 2010,
     1, 0, 0, None, "hinwil", 0,
     "BMW's works entry, second in the 2007 constructors' championship. Withdrew after 2009.", "high"),
    ("lotus-f1", "Lotus F1 Team", "Lotus F1 Team", "United Kingdom", "Enstone, United Kingdom", 2012, 2015,
     2, 0, 0, None, "enstone", 0,
     "The Enstone team under Genii Capital ownership, using the Lotus name by licence. Raikkonen won in Abu Dhabi 2012 and Australia 2013.", "high"),
    ("toyota", "Toyota", "Panasonic Toyota Racing", "Japan", "Cologne, Germany", 2002, 2009,
     0, 0, 0, None, "toyota-chain", 0,
     "The largest budget in the sport for much of its run and no wins from 139 starts. Withdrew after 2009.", "high"),
    ("minardi", "Minardi", "Minardi F1 Team", "Italy", "Faenza, Italy", 1985, 2005,
     0, 0, 0, None, "faenza", 0,
     "The Faenza team's original identity; a proving ground for Alonso, Trulli, Fisichella and Webber. Sold to Red Bull in 2005.", "high"),
    ("arrows", "Arrows", "Arrows Grand Prix International", "United Kingdom", "Leafield, United Kingdom", 1978, 2002,
     0, 0, 0, None, "arrows-chain", 0,
     "382 starts without a win — the most of any constructor. Came closest with Damon Hill at the Hungaroring in 1997.", "high"),
    ("prost-gp", "Prost Grand Prix", "Prost Grand Prix", "France", "Guyancourt, France", 1997, 2001,
     0, 0, 0, None, "ligier-chain", 0,
     "Alain Prost's purchase of Ligier; collapsed in bankruptcy in 2002.", "medium"),
    ("super-aguri", "Super Aguri", "Super Aguri F1 Team", "Japan", "Leafield, United Kingdom", 2006, 2008,
     0, 0, 0, None, "super-aguri", 0,
     "Aguri Suzuki's Honda-backed team; scored a point at Montreal in 2007 and folded mid-2008.", "medium"),
    ("hrt", "HRT", "Hispania Racing Team", "Spain", "Murcia, Spain", 2010, 2012,
     0, 0, 0, None, "hrt-chain", 0,
     "One of the three 2010 entrants admitted on the promise of a budget cap that never arrived. Never scored a point.", "medium"),
    ("virgin", "Virgin Racing / Marussia / Manor", "Manor Racing", "United Kingdom", "Banbury, United Kingdom", 2010, 2016,
     0, 0, 0, None, "manor", 0,
     "Ran as Virgin, Marussia and Manor. Jules Bianchi's ninth place at Monaco in 2014 was its only points finish; he was fatally injured at Suzuka that year.", "high"),
    ("caterham", "Caterham / Team Lotus (2010-14)", "Caterham F1 Team", "United Kingdom", "Leafield, United Kingdom", 2010, 2014,
     0, 0, 0, None, "caterham", 0,
     "Entered as Lotus Racing, raced as Team Lotus in 2011 amid a naming dispute with the Enstone team, then as Caterham. Never scored.", "medium"),
    ("toleman", "Toleman", "Toleman Group Motorsport", "United Kingdom", "Witney, United Kingdom", 1981, 1985,
     0, 0, 0, None, "enstone", 0,
     "Ayrton Senna's first team; his second place in the Monaco rain of 1984 announced him. Sold to Benetton.", "high"),
    ("surtees-team", "Surtees", "Team Surtees", "United Kingdom", "Edenbridge, United Kingdom", 1970, 1978,
     0, 0, 0, None, "surtees-chain", 0,
     "John Surtees's own constructor.", "medium"),
    ("eagle", "Eagle", "Anglo American Racers", "United States", "Rye, United States", 1966, 1969,
     1, 0, 0, None, "eagle-chain", 0,
     "Dan Gurney won the 1967 Belgian GP in a car of his own construction — one of only two men to do so.", "high"),
    ("porsche", "Porsche", "Porsche System Engineering", "Germany", "Stuttgart, Germany", 1957, 1964,
     1, 0, 0, None, "porsche-chain", 0,
     "Won the 1962 French GP with Dan Gurney. Returned as an engine supplier badged TAG in the 1980s.", "high"),
    ("lancia", "Lancia", "Scuderia Lancia", "Italy", "Turin, Italy", 1954, 1955,
     0, 0, 0, None, "lancia-chain", 0,
     "The D50 was handed to Ferrari after Ascari's death and won the 1956 title in Fangio's hands as the Lancia-Ferrari.", "high"),
    ("rob-walker", "Rob Walker Racing", "R.R.C. Walker Racing Team", "United Kingdom", "Dorking, United Kingdom", 1953, 1970,
     9, 0, 0, None, "walker-chain", 0,
     "The most successful private entrant in history: Moss's 1958 Argentine GP win was the first for a mid-engined car and the first for a privateer.", "high"),
]

# ---------------------------------------------------------------------
# Lineage: one continuous racing operation, many names.
# chain_id, chain_name, sequence, entity_name, constructor_id, from_year,
# to_year, note
#
# constructor_id is the constructors row the period's race entries are
# recorded under - not the one whose name matches entity_name. They differ:
# Alfa Romeo 2019-23 and Kick Sauber raced as `sauber`, and Team Lotus 2011
# is `caterham`, not the `lotus` of 1958-94. verify.py holds every race entry
# under a constructor named here to exactly one of its periods, and every
# period to at least one of its constructor's entries.
# ---------------------------------------------------------------------
LINEAGE = [
    ("enstone", "The Enstone team", 1, "Toleman", "toleman", 1981, 1985, "Founded by a Essex-based haulage group; Senna's first F1 seat."),
    ("enstone", "The Enstone team", 2, "Benetton", "benetton", 1986, 2001, "Two drivers' titles (1994, 1995) and one constructors' (1995)."),
    ("enstone", "The Enstone team", 3, "Renault", "renault", 2002, 2011, "Doubles in 2005 and 2006 with Alonso."),
    ("enstone", "The Enstone team", 4, "Lotus F1 Team", "lotus-f1", 2012, 2015, "Name licensed from Group Lotus; two wins with Raikkonen."),
    ("enstone", "The Enstone team", 5, "Renault", "renault", 2016, 2020, "Works Renault entry restored."),
    ("enstone", "The Enstone team", 6, "Alpine", "alpine", 2021, None, "Rebadged to Renault's sports-car brand."),

    ("brackley", "The Brackley team", 1, "Tyrrell", "tyrrell", 1970, 1998, "Ken Tyrrell's constructor; entry sold to BAT."),
    ("brackley", "The Brackley team", 2, "British American Racing (BAR)", "bar", 1999, 2005, "Tobacco-funded relaunch; second in 2004."),
    ("brackley", "The Brackley team", 3, "Honda Racing F1", "honda-works", 2006, 2008, "Works Honda; withdrew in the financial crisis."),
    ("brackley", "The Brackley team", 4, "Brawn GP", "brawn", 2009, 2009, "Management buyout; won both titles in its only season."),
    ("brackley", "The Brackley team", 5, "Mercedes", "mercedes", 2010, None, "Eight consecutive constructors' titles, 2014-2021."),

    ("milton-keynes", "The Milton Keynes team", 1, "Stewart Grand Prix", "stewart-gp", 1997, 1999, "Won at the Nurburgring in 1999."),
    ("milton-keynes", "The Milton Keynes team", 2, "Jaguar Racing", "jaguar", 2000, 2004, "Ford ownership; no wins."),
    ("milton-keynes", "The Milton Keynes team", 3, "Red Bull Racing", "red-bull", 2005, None, "Six constructors' titles and eight drivers' titles."),

    ("faenza", "The Faenza team", 1, "Minardi", "minardi", 1985, 2005, "Twenty-one seasons as the grid's most-loved underdog."),
    ("faenza", "The Faenza team", 2, "Scuderia Toro Rosso", "toro-rosso", 2006, 2019, "Vettel's Monza win in 2008."),
    ("faenza", "The Faenza team", 3, "Scuderia AlphaTauri", "alphatauri", 2020, 2023, "Gasly's Monza win in 2020."),
    ("faenza", "The Faenza team", 4, "RB / Racing Bulls", "racing-bulls", 2024, None, "Repositioned as an explicit Red Bull feeder."),

    ("silverstone", "The Silverstone (Jordan) team", 1, "Jordan Grand Prix", "jordan", 1991, 2005, "Four wins; third in the 1999 championship."),
    ("silverstone", "The Silverstone (Jordan) team", 2, "MF1 / Midland", "midland", 2006, 2006, "Russian-Canadian ownership."),
    ("silverstone", "The Silverstone (Jordan) team", 3, "Spyker", "spyker", 2007, 2007, "Dutch sports-car owner; one season."),
    ("silverstone", "The Silverstone (Jordan) team", 4, "Force India", "force-india", 2008, 2018, "Fourth in 2016 and 2017 on a fraction of the budget."),
    ("silverstone", "The Silverstone (Jordan) team", 5, "Racing Point", "racing-point", 2019, 2020, "Stroll consortium rescue; won the Sakhir GP."),
    ("silverstone", "The Silverstone (Jordan) team", 6, "Aston Martin", "aston-martin", 2021, None, "New factory and wind tunnel at Silverstone; Newey arrived for 2026."),

    ("hinwil", "The Hinwil team", 1, "Sauber", "sauber", 1993, 2005, "Peter Sauber's independent constructor."),
    ("hinwil", "The Hinwil team", 2, "BMW Sauber", "bmw-sauber", 2006, 2010, "Works BMW; won in Canada 2008."),
    ("hinwil", "The Hinwil team", 3, "Sauber", "sauber", 2010, 2018, "Independent again after BMW's exit."),
    ("hinwil", "The Hinwil team", 4, "Alfa Romeo", "sauber", 2019, 2023, "Alfa naming rights over a Ferrari-powered Sauber."),
    ("hinwil", "The Hinwil team", 5, "Kick Sauber", "sauber", 2024, 2025, "Interim identity during the Audi transition."),
    ("hinwil", "The Hinwil team", 6, "Audi", "audi", 2026, None, "Full works Audi entry with its own power unit."),

    ("grove", "The Williams team", 1, "Frank Williams Racing Cars", "frank-williams-racing-cars", 1969, 1976, "Frank Williams's first venture; entered customer cars."),
    ("grove", "The Williams team", 2, "Williams Grand Prix Engineering", "williams", 1977, None, "Founded with Patrick Head; nine constructors' titles."),

    ("manor", "The Manor team", 1, "Virgin Racing", "virgin", 2010, 2011, "One of three new 2010 entrants."),
    ("manor", "The Manor team", 2, "Marussia", "virgin", 2012, 2015, "Bianchi scored its only points at Monaco 2014."),
    ("manor", "The Manor team", 3, "Manor Racing", "virgin", 2016, 2016, "Folded in January 2017."),

    ("caterham", "The Caterham team", 1, "Lotus Racing", "caterham", 2010, 2010, "Entered under a Group Lotus licence."),
    ("caterham", "The Caterham team", 2, "Team Lotus", "caterham", 2011, 2011, "Naming dispute with the Enstone team."),
    ("caterham", "The Caterham team", 3, "Caterham F1", "caterham", 2012, 2014, "Never scored a point in 94 starts."),

    ("ligier-chain", "The Magny-Cours team", 1, "Ligier", "ligier", 1976, 1996, "Nine wins; a fixture of French motorsport."),
    ("ligier-chain", "The Magny-Cours team", 2, "Prost Grand Prix", "prost-gp", 1997, 2001, "Bought by Alain Prost; bankrupt in 2002."),

    # Four names this sport reused. Each constructor below raced a first spell
    # under the name that a later, unrelated operation took over, so its
    # constructors row carries the later chain and these years belong to no
    # multi-name chain at all. They are chains of one, declared, so that every
    # race entry under a chained constructor lies inside exactly one period -
    # which verify.py holds - and a win at Viry in 1982 cannot be counted
    # through Enstone. The two spells are the constructors rows' own notes.
    ("renault-1977", "The works Renault team, 1977-85", 1, "Renault", "renault", 1977, 1985,
     "The first works Renault entry, which raced alongside Toleman from 1981; the Renault name reached the Enstone team only in 2002."),
    ("mercedes-1954", "The works Mercedes team, 1954-55", 1, "Mercedes", "mercedes", 1954, 1955,
     "Withdrew after 1955; the Brackley team took the Mercedes name in 2010."),
    ("honda-1964", "The works Honda team, 1964-68", 1, "Honda", "honda-works", 1964, 1968,
     "Withdrew after 1968; Honda bought BAR and raced it under its own name from 2006."),
    ("aston-martin-1959", "The works Aston Martin team, 1959-60", 1, "Aston Martin", "aston-martin", 1959, 1960,
     "Withdrew after 1960; the Silverstone team took the Aston Martin name in 2021."),
]

# ---------------------------------------------------------------------
# Engine / power-unit manufacturers
# id, name, country, first_year, last_year, wins, c_titles, d_titles, notes, confidence
# ---------------------------------------------------------------------
ENGINES = [
    ("ferrari-eng", "Ferrari", "Italy", 1950, None, None, 16, 15,
     "The only manufacturer present for every season. Supplies Haas and Cadillac as well as the works team in 2026.", "medium"),
    ("cosworth", "Ford Cosworth", "United Kingdom/United States", 1967, 2013, 176, 10, 13,
     "The DFV, funded by Ford for £100,000, won on debut at Zandvoort in 1967 and 155 Grands Prix in all. It made the customer-chassis garagiste team viable and defined F1 for two decades.", "medium"),
    ("mercedes-eng", "Mercedes", "Germany", 1954, None, None, 9, 10,
     "Dominated the first turbo-hybrid years with a split-turbo layout that rivals took three seasons to match. Supplies McLaren, Williams and Alpine in 2026.", "medium"),
    ("renault-eng", "Renault", "France", 1977, 2024, 168, 12, 11,
     "Introduced the turbo to F1 in 1977 and powered Williams, Benetton and Red Bull to titles as a supplier. Withdrew from power-unit supply after 2024.", "medium"),
    ("honda-eng", "Honda", "Japan", 1964, None, None, 6, 6,
     "Four distinct eras: works constructor 1964-68, supplier to Williams and McLaren 1983-92, 2000s works entry, and the 2015- return that powered Verstappen's four titles. Badged HRC and supplying Aston Martin in 2026.", "medium"),
    ("climax", "Coventry Climax", "United Kingdom", 1953, 1965, None, 4, 4,
     "A fire-pump engine manufacturer whose FPF and FWMV engines powered Cooper and Lotus to championships.", "medium"),
    ("brm-eng", "BRM", "United Kingdom", 1951, 1977, None, 1, 1,
     "Built the 1.5 L V8 that won the 1962 title and the notoriously complex H16.", "medium"),
    ("tag-porsche", "TAG (Porsche)", "Germany", 1983, 1987, 25, 2, 3,
     "Porsche-built, TAG-funded turbo V6 that powered McLaren to three drivers' and two constructors' titles.", "high"),
    ("bmw-eng", "BMW", "Germany", 1982, 2009, 20, 1, 1,
     "The M12/13 four-cylinder turbo, derived from a production block, is credited with over 1,400 bhp in qualifying trim in 1986 — the highest figure ever run in F1.", "medium"),
    ("repco", "Repco", "Australia", 1966, 1969, 8, 2, 2,
     "An Australian parts company whose lightweight V8 won two titles for Brabham in the first years of the 3.0 L formula.", "high"),
    ("matra-eng", "Matra", "France", 1968, 1982, None, 1, 1,
     "The V12 was slow but its sound is among the most celebrated in the sport.", "medium"),
    ("alfa-eng", "Alfa Romeo", "Italy", 1950, 1988, None, 0, 2,
     "The supercharged 158/159 straight-eight won the first two titles.", "medium"),
    ("maserati-eng", "Maserati", "Italy", 1950, 1969, None, 0, 1,
     "Powered Fangio's 1957 title in the 250F.", "medium"),
    ("weslake", "Weslake", "United Kingdom", 1966, 1969, 1, 0, 0,
     "Powered Gurney's Eagle to victory at Spa in 1967.", "medium"),
    ("judd", "Judd", "United Kingdom", 1988, 1992, 0, 0, 0, "An independent customer supplier of the late 1980s.", "medium"),
    ("hart", "Hart", "United Kingdom", 1981, 1997, 0, 0, 0, "Brian Hart's independent engines, used by Toleman, Jordan and Arrows.", "medium"),
    ("yamaha", "Yamaha", "Japan", 1989, 1997, 0, 0, 0, "Never won; came closest with Damon Hill's Arrows at the 1997 Hungarian GP.", "medium"),
    ("peugeot", "Peugeot", "France", 1994, 2000, 0, 0, 0, "Supplied McLaren, Jordan and Prost without a win.", "medium"),
    ("mugen", "Mugen-Honda", "Japan", 1992, 2000, 4, 0, 0, "A Honda-derived independent that won with Ligier and Jordan.", "medium"),
    ("toyota-eng", "Toyota", "Japan", 2002, 2009, 0, 0, 0, "Supplied its own team plus Williams; no wins.", "medium"),
    ("rbpt", "Red Bull Powertrains", "Austria/United Kingdom", 2022, None, None, 2, 3,
     "Created when Honda withdrew as a badged supplier; from 2026 a full in-house power unit developed with Ford.", "medium"),
    ("audi-eng", "Audi", "Germany", 2026, None, 0, 0, 0,
     "Designed and built at Neuburg an der Donau — the first all-new works manufacturer power unit of the 2026 formula.", "verified"),
]

# id, from_year, to_year, era_name, formula, aspiration, config, power, revs, notes
ENGINE_ERAS = [
    (1, 1950, 1951, "The Alfetta era", "1.5 L supercharged or 4.5 L naturally aspirated", "Both", "Straight-8 / V12",
     "350-425", "~8,500 rpm", "Pre-war technology carried into the new championship. Alfa's 159 used around 125 litres of fuel per 100 km."),
    (2, 1952, 1953, "The Formula 2 interregnum", "2.0 L naturally aspirated (F2)", "Naturally aspirated", "Straight-4",
     "165-180", "~7,000 rpm", "Adopted because too few F1 cars remained after Alfa Romeo's withdrawal."),
    (3, 1954, 1960, "The 2.5-litre formula", "2.5 L naturally aspirated", "Naturally aspirated", "Straight-4 to V8",
     "250-290", "~8,000 rpm", "Mercedes's desmodromic-valve W196 and the Maserati 250F belong to this period; ends with the rear-engine revolution."),
    (4, 1961, 1965, "The 1.5-litre formula", "1.5 L naturally aspirated", "Naturally aspirated", "V8 / flat-8 / H16",
     "150-225", "up to 12,000 rpm", "Unpopular on introduction for cutting power, but produced light, nimble cars and Clark's Lotus 25 monocoque."),
    (5, 1966, 1976, "The return of power", "3.0 L naturally aspirated or 1.5 L forced induction", "Naturally aspirated in practice", "V8 / V12 / flat-12",
     "400-500", "10,000-12,500 rpm", "The Cosworth DFV arrived in 1967 and made the independent constructor viable."),
    (6, 1977, 1988, "The turbo era", "3.0 L naturally aspirated or 1.5 L turbocharged", "Both", "Turbo I4 / V6",
     "600-900 race, 1,000-1,400+ qualifying", "11,000-12,000 rpm",
     "Renault's RS01 introduced turbocharging in 1977. Qualifying boost produced the highest power outputs in the sport's history before boost limits (4.0 bar in 1987, 2.5 bar in 1988) closed the era."),
    (7, 1989, 1994, "The 3.5-litre naturally aspirated formula", "3.5 L naturally aspirated", "Naturally aspirated", "V8 / V10 / V12",
     "600-780", "12,000-14,500 rpm", "Turbos banned outright. The V10 emerged as the best compromise between the V8's weight and the V12's power."),
    (8, 1995, 2005, "The V10 era", "3.0 L naturally aspirated", "Naturally aspirated", "V10 (mandated from 2000)",
     "700-980", "up to 19,000 rpm", "Capacity cut for safety after 1994. By 2005 the best engines revved past 19,000 rpm and lasted two race weekends."),
    (9, 2006, 2013, "The V8 era", "2.4 L naturally aspirated V8", "Naturally aspirated", "V8",
     "720-780", "20,000 rpm to 2006, then 19,000, then 18,000 from 2009",
     "Rev limits and long-life rules progressively froze development. KERS introduced in 2009."),
    (10, 2014, 2025, "The turbo-hybrid era", "1.6 L V6 turbocharged hybrid", "Turbocharged", "V6 + MGU-K + MGU-H",
     "~850-1,050 combined", "15,000 rpm limit (practically ~12,000)",
     "Thermal efficiency passed 50% — roughly double a road engine. Mercedes's split-turbo layout, with compressor and turbine at opposite ends of the engine, gave it a multi-year advantage."),
    (11, 2026, None, "The 50/50 hybrid formula", "1.6 L V6 turbo hybrid, no MGU-H", "Turbocharged", "V6 + MGU-K",
     "~1,000 combined, roughly half electrical", "15,000 rpm",
     "MGU-H removed to cut cost and complexity and to attract new manufacturers; electrical power raised to around 350 kW; 100% advanced sustainable fuel mandated. Audi, Ford (with Red Bull) and Cadillac's forthcoming GM unit were all drawn in by this ruleset."),
]

# ---------------------------------------------------------------------
# Constructors admitted from the F1DB register.
#
# Eighty-five teams that entered a championship Grand Prix and had no row
# here. Both loaders reported them independently - ergast_load.py listed
# them as "constructors not in the register, stored as NULL", and the
# chassis work left 593 entrant rows and 256 chassis unable to join to
# anything. Ensign started 133 Grands Prix, Osella 172, and neither existed
# in this database.
#
# What is authored and what is not
# --------------------------------
# The IDS below are the register decision and are written out one per line,
# reviewable, with the seasons and entry count that justify each. The
# ATTRIBUTES - name, full name, country, first and last entry - are NOT
# typed here. They are read at build time from harvest/f1db_constructors.txt
# and harvest/entrant_drivers.txt, both generated by tools/f1db_fetch.py.
#
# That split is the point. CONTRIBUTING.md forbids inventing a register
# entry from a bulk feed; it does not forbid a person deciding which
# entities exist and letting the machine supply their spelling. Nobody
# types eighty-five team names, and no team appears without a line someone
# read.
#
# The admission test
# ------------------
# A constructor is admitted when it entered at least one championship race
# that was NOT the Indianapolis 500. That test, not a judgement about
# stature, is what separates these from the thirty-one Indianapolis chassis
# makers the project has always excluded - Kuzma, Watson, Epperly and the
# rest were never Formula One constructors, and giving them rows would put
# 185 entrant rows of Indianapolis roadsters into the constructor
# statistics.
#
# Kurtis Kraft is the one that fails cleanly on neither side, and is
# excluded deliberately: 185 of its 186 entries are Indianapolis, and the
# exception is Rodger Ward's midget at Sebring in 1959. Admitting it to
# capture one entry would drag the other 185 in with it. Declared in
# F1DB_CONSTRUCTOR_NON_MAPPING below.
#
# wins is left NULL for every one of them, which build.py reads as "derive
# it from the race records". None of the eighty-five won a championship
# race; if that is ever wrong, verify.py's constructor win reconciliation
# says so.
# ---------------------------------------------------------------------
F1DB_CONSTRUCTORS = [
    "alta",                          # 1950-1952     5   Alta
    "era",                           # 1950-1952     7   ERA
    "simca-gordini",                 # 1950-1953    15   Simca-Gordini
    "hwm",                           # 1951-1955    16   HWM
    "osca",                          # 1951-1958     7   O.S.C.A.
    "veritas",                       # 1951-1953     6   Veritas
    "afm",                           # 1952-1953     4   AFM
    "aston-butterworth",             # 1952          4   Aston Butterworth
    "balsa",                         # 1952          1   Balsa
    "cisitalia",                     # 1952          1   Cisitalia
    "frazer-nash",                   # 1952          4   Frazer-Nash
    "heck",                          # 1952-1953     2   Heck
    "krakau",                        # 1952          1   Krakau
    "nacke",                         # 1952          1   Nacke
    "reif",                          # 1952          1   Reif
    "emw",                           # 1953          1   EMW
    "greifzu",                       # 1953          1   Greifzu
    "klenk",                         # 1954          1   Klenk
    "arzani-volpini",                # 1955          1   Arzani-Volpini
    "bugatti",                       # 1956          1   Bugatti
    "emeryson",                      # 1956-1962     6   Emeryson
    "behra-porsche",                 # 1959-1960     4   Behra-Porsche
    "fry",                           # 1959          1   Fry
    "jbw",                           # 1959-1961     6   JBW
    "tec-mec",                       # 1959          1   Tec-Mec
    "scarab",                        # 1960          5   Scarab
    "de-tomaso",                     # 1961-1970    15   De Tomaso
    "ferguson",                      # 1961          1   Ferguson
    "gilby",                         # 1961-1963     6   Gilby
    "enb",                           # 1962          1   ENB
    "lds",                           # 1962-1968     5   LDS
    "alfa-special",                  # 1963-1965     2   Alfa Special
    "ats",                           # 1963          5   ATS
    "brp",                           # 1963-1964    13   BRP
    "scirocco",                      # 1963-1964     7   Scirocco
    "stebro",                        # 1963          1   Stebro
    "derrington-francis",            # 1964          1   Derrington-Francis
    "shannon",                       # 1966          1   Shannon
    "protos",                        # 1967          1   Protos
    "bmw",                           # 1969          1   BMW
    "tecno",                         # 1969-1973    14   Tecno
    "bellasi",                       # 1970-1971     6   Bellasi
    "connew",                        # 1972          2   Connew
    "eifelland",                     # 1972          8   Eifelland
    "politoys",                      # 1972          1   Politoys
    "ensign",                        # 1973-1982   133   Ensign
    "iso-marlboro",                  # 1973-1974    30   Iso-Marlboro
    "amon",                          # 1974          4   Amon
    "lyncar",                        # 1974-1975     2   Lyncar
    "maki",                          # 1974-1976     8   Maki
    "parnelli",                      # 1974-1976    16   Parnelli
    "token",                         # 1974          4   Token
    "trojan",                        # 1974          8   Trojan
    "frank-williams-racing-cars",    # 1975         14   Frank Williams Racing Cars
    "hill",                          # 1975         11   Hill
    "boro",                          # 1976-1977     8   Boro
    "kojima",                        # 1976-1977     2   Kojima
    "wolf-williams",                 # 1976         16   Wolf-Williams
    "apollon",                       # 1977          1   Apollon
    "lec",                           # 1977          5   LEC
    "mcguire",                       # 1977          1   McGuire
    "ats-wheels",                    # 1978-1984   107   ATS
    "martini",                       # 1978          7   Martini
    "merzario",                      # 1978-1979    31   Merzario
    "theodore",                      # 1978-1983    51   Theodore
    "kauhsen",                       # 1979          2   Kauhsen
    "rebaque",                       # 1979          3   Rebaque
    "osella",                        # 1980-1990   172   Osella
    "ram",                           # 1983-1985    44   RAM
    "spirit",                        # 1983-1985    25   Spirit
    "zakspeed",                      # 1985-1989    74   Zakspeed
    "ags",                           # 1986-1991    80   AGS
    "coloni",                        # 1987-1991    65   Coloni
    "eurobrun",                      # 1988-1990    46   EuroBrun
    "rial",                          # 1988-1989    32   Rial
    "life",                          # 1990         14   Life
    "fondmetal",                     # 1991-1992    29   Fondmetal
    "modena",                        # 1991         16   Modena
    "andrea-moda",                   # 1992         11   Andrea Moda
    "venturi",                       # 1992         16   Venturi
    "pacific",                       # 1994-1995    33   Pacific
    "simtek",                        # 1994-1995    21   Simtek
    "forti",                         # 1995-1996    27   Forti
    "midland",                       # 2006         18   Midland
    "spyker",                        # 2007         17   Spyker
]

# Teams F1DB registers as constructors that this register deliberately does
# NOT admit, with the reason. Declared so that a later widening of the
# admission test cannot pick them up silently.
F1DB_CONSTRUCTOR_NON_MAPPING = {
    "kurtis-kraft":
        "185 of its 186 championship entries are the Indianapolis 500 in "
        "the years it counted, which this project has always kept out of "
        "the constructor statistics. The exception is Rodger Ward's Kurtis "
        "Kraft midget at Sebring in 1959 - a genuine Grand Prix entry, and "
        "the one thing lost by excluding it. Admitting the constructor to "
        "capture that single entry would bring the other 185 with it.",
}

# F1DB constructor ids that are another name for a team this register
# already holds. Not new constructors: the same entity, renamed.
F1DB_CONSTRUCTOR_ALIASES = {
    "kick-sauber": "sauber",      # the 2024-25 name; sauber's own note says so
    "marussia": "virgin",         # virgin is "Virgin Racing / Marussia / Manor"
    "manor": "virgin",            # the 2016 name of the same entry
    "lotus-racing": "caterham",   # caterham entered as Lotus Racing in 2010-11
}
