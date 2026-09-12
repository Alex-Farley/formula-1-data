# -*- coding: utf-8 -*-
"""
Driver register.

Coverage: every World Champion (35), every notable Grand Prix winner,
and the full 2026 entry list.

Tuple order:
 id, full_name, nationality, code, born, died, first_season, last_season,
 entries, starts, wins, podiums, poles, fastest_laps, points, titles,
 title_years, status, notes, confidence

Career totals for champions are career-final where the driver has
retired. For active drivers the figures are stated as at the end of the
2025 season unless the note says otherwise; 2026 is in progress and
these will move.
"""

CHAMPIONS = [
    ("farina", "Giuseppe 'Nino' Farina", "Italy", "ITA", "1906-10-30", "1966-06-30", 1950, 1955,
     35, 33, 5, 20, 5, 5, 127.33, 1, "1950", "deceased",
     "The sport's first World Champion. Already 43 at the first race; killed in a road accident on the way to the 1966 French GP.", "high"),
    ("fangio", "Juan Manuel Fangio", "Argentina", "ARG", "1911-06-24", "1995-07-17", 1950, 1958,
     52, 51, 24, 35, 29, 23, 245.14, 5, "1951,1954,1955,1956,1957", "deceased",
     "Titles with four different constructors — Alfa Romeo, Mercedes, Ferrari and Maserati — a feat never repeated. Won 47% of the races he started, still the highest win rate in the sport.", "high"),
    ("ascari", "Alberto Ascari", "Italy", "ITA", "1918-07-13", "1955-05-26", 1950, 1955,
     33, 32, 13, 17, 14, 12, 140.64, 2, "1952,1953", "deceased",
     "Won nine consecutive championship races across 1952-53, a record that stood until Verstappen in 2023. Killed testing a Ferrari sports car at Monza four days after surviving a plunge into Monaco harbour.", "high"),
    ("hawthorn", "Mike Hawthorn", "United Kingdom", "GBR", "1929-04-10", "1959-01-22", 1952, 1958,
     47, 45, 3, 18, 4, 6, 127.64, 1, "1958", "deceased",
     "Britain's first World Champion, taken with a single win. Retired immediately after the title and was killed in a road crash on the Guildford bypass three months later.", "high"),
    ("brabham", "Sir Jack Brabham", "Australia", "AUS", "1926-04-02", "2014-05-19", 1955, 1970,
     128, 126, 14, 31, 13, 12, 261, 3, "1959,1960,1966", "deceased",
     "The only driver to win the World Championship in a car of his own construction (1966). Pushed his out-of-fuel Cooper over the line to clinch the 1959 title at Sebring.", "high"),
    ("p-hill", "Phil Hill", "United States", "USA", "1927-04-20", "2008-08-28", 1958, 1966,
     51, 48, 3, 16, 6, 6, 98, 1, "1961", "deceased",
     "First American World Champion. Took the title at Monza in the race that killed his team-mate von Trips and 15 spectators.", "high"),
    ("g-hill", "Graham Hill", "United Kingdom", "GBR", "1929-02-15", "1975-11-29", 1958, 1975,
     179, 176, 14, 36, 13, 10, 289, 2, "1962,1968", "deceased",
     "The only driver to complete the Triple Crown: Monaco GP, Indianapolis 500 and Le Mans 24 Hours. Five Monaco wins. Killed piloting his own aircraft in fog near Elstree.", "high"),
    ("clark", "Jim Clark", "United Kingdom", "GBR", "1936-03-04", "1968-04-07", 1960, 1968,
     73, 72, 25, 32, 33, 28, 274, 2, "1963,1965", "deceased",
     "Took pole for nearly half his starts. Won the F1 title and the Indianapolis 500 in 1965. Killed in a Formula 2 race at Hockenheim, a death that shook the sport's assumptions about driver invulnerability.", "high"),
    ("surtees", "John Surtees", "United Kingdom", "GBR", "1934-02-11", "2017-03-10", 1960, 1972,
     113, 111, 6, 24, 8, 11, 180, 1, "1964", "deceased",
     "The only World Champion on both two wheels (seven motorcycle world titles) and four. Later ran his own constructor, Team Surtees.", "medium"),
    ("hulme", "Denny Hulme", "New Zealand", "NZL", "1936-06-18", "1992-10-04", 1965, 1974,
     114, 112, 8, 33, 1, 9, 248, 1, "1967", "deceased",
     "'The Bear'. Beat his own employer Jack Brabham to the 1967 title. Died of a heart attack while racing at Bathurst.", "high"),
    ("stewart", "Sir Jackie Stewart", "United Kingdom", "GBR", "1939-06-11", None, 1965, 1973,
     100, 99, 27, 43, 17, 15, 360, 3, "1969,1971,1973", "retired",
     "After the titles came a second career as the sport's most consequential safety campaigner — barriers, medical cars, seatbelts, full-face helmets, run-off. Retired one race early after the death of team-mate Cevert.", "high"),
    ("rindt", "Jochen Rindt", "Austria", "AUT", "1942-04-18", "1970-09-05", 1964, 1970,
     62, 60, 6, 13, 10, 3, 109, 1, "1970", "deceased",
     "The sport's only posthumous World Champion. Killed in practice at Monza; no rival could catch his points total over the remaining races.", "high"),
    ("fittipaldi", "Emerson Fittipaldi", "Brazil", "BRA", "1946-12-12", None, 1970, 1980,
     149, 144, 14, 35, 6, 6, 281, 2, "1972,1974", "retired",
     "Youngest champion for 33 years at 25. Left McLaren at his peak to run the family Copersucar team, then won the Indianapolis 500 twice.", "high"),
    ("lauda", "Niki Lauda", "Austria", "AUT", "1949-02-22", "2019-05-20", 1971, 1985,
     177, 171, 25, 54, 24, 24, 420.5, 3, "1975,1977,1984", "deceased",
     "Survived catastrophic burns at the Nurburgring in 1976 and returned six weeks later. Later non-executive chairman of Mercedes, where he recruited Hamilton.", "high"),
    ("hunt", "James Hunt", "United Kingdom", "GBR", "1947-08-29", "1993-06-15", 1973, 1979,
     93, 92, 10, 23, 14, 8, 179, 1, "1976", "deceased",
     "Took the 1976 title by one point in the Fuji rain. Later a famously unvarnished BBC commentator alongside Murray Walker.", "high"),
    ("andretti", "Mario Andretti", "United States", "USA", "1940-02-28", None, 1968, 1982,
     131, 128, 12, 19, 18, 10, 180, 1, "1978", "retired",
     "Champion in the ground-effect Lotus 79. Also won the Indianapolis 500, the IndyCar title four times and the Daytona 500 — arguably the most versatile record in motorsport.", "high"),
    ("scheckter", "Jody Scheckter", "South Africa", "RSA", "1950-01-29", None, 1972, 1980,
     113, 112, 10, 33, 3, 5, 255, 1, "1979", "retired",
     "Ferrari's last champion for 21 years. Retired at 30 and became an organic farmer in Hampshire.", "medium"),
    ("jones", "Alan Jones", "Australia", "AUS", "1946-11-02", None, 1975, 1986,
     117, 116, 12, 24, 6, 13, 206, 1, "1980", "retired",
     "Delivered Williams its first drivers' title and set the template for the team's uncompromising number-one culture.", "high"),
    ("piquet", "Nelson Piquet", "Brazil", "BRA", "1952-08-17", None, 1978, 1991,
     207, 204, 23, 60, 24, 23, 485.5, 3, "1981,1983,1987", "retired",
     "First champion of the turbo era (1983). Won titles with both Brabham and Williams.", "high"),
    ("k-rosberg", "Keke Rosberg", "Finland", "FIN", "1948-12-06", None, 1978, 1986,
     128, 114, 5, 17, 5, 3, 159.5, 1, "1982", "retired",
     "Took the 1982 title with a single win in the most turbulent season on record. Father of 2016 champion Nico Rosberg.", "high"),
    ("prost", "Alain Prost", "France", "FRA", "1955-02-24", None, 1980, 1993,
     202, 199, 51, 106, 33, 41, 798.5, 4, "1985,1986,1989,1993", "retired",
     "'The Professor' — won by managing races rather than dominating laps. His rivalry with Senna defined the era. Held the win record (51) from 1987 until Schumacher passed it in 2001.", "high"),
    ("senna", "Ayrton Senna", "Brazil", "BRA", "1960-03-21", "1994-05-01", 1984, 1994,
     162, 161, 41, 80, 65, 19, 610, 3, "1988,1990,1991", "deceased",
     "Six Monaco wins including five straight. Killed at Imola on 1 May 1994; the crash triggered the most sweeping safety overhaul in the sport's history.", "high"),
    ("mansell", "Nigel Mansell", "United Kingdom", "GBR", "1953-08-08", None, 1980, 1995,
     191, 187, 31, 59, 32, 30, 482, 1, "1992", "retired",
     "Won the title at the 13th attempt in the Williams FW14B, then left for IndyCar and won that championship as a rookie — the only driver to hold both titles simultaneously.", "high"),
    ("schumacher", "Michael Schumacher", "Germany", "GER", "1969-01-03", None, 1991, 2012,
     308, 306, 91, 155, 68, 77, 1566, 7, "1994,1995,2000,2001,2002,2003,2004", "retired",
     "Five consecutive titles with Ferrari. Held the record for wins (91) until 2020. Suffered a severe brain injury skiing in December 2013.", "high"),
    ("d-hill", "Damon Hill", "United Kingdom", "GBR", "1960-09-17", None, 1992, 1999,
     122, 115, 22, 42, 20, 19, 360, 1, "1996", "retired",
     "Son of Graham Hill; the first second-generation World Champion. Dropped by Williams the year he won the title.", "high"),
    ("villeneuve-j", "Jacques Villeneuve", "Canada", "CAN", "1971-04-09", None, 1996, 2006,
     165, 163, 11, 23, 13, 9, 235, 1, "1997", "retired",
     "Son of Gilles Villeneuve. Won the Indianapolis 500 and IndyCar title before arriving in F1 and taking pole on debut at Melbourne.", "high"),
    ("hakkinen", "Mika Hakkinen", "Finland", "FIN", "1968-09-28", None, 1991, 2001,
     165, 161, 20, 51, 26, 25, 420, 2, "1998,1999", "retired",
     "Survived a life-threatening crash at Adelaide in 1995. Senna named him the rival he rated most highly.", "high"),
    ("alonso", "Fernando Alonso", "Spain", "ESP", "1981-07-29", None, 2001, None,
     None, 415, 32, 106, 22, 26, None, 2, "2005,2006", "active",
     "Ended Schumacher's run in 2005 as the then-youngest champion. Still racing in 2026 at 45; holds the record for most race starts. Also won Le Mans twice and the WEC title.", "medium"),
    ("raikkonen", "Kimi Raikkonen", "Finland", "FIN", "1979-10-17", None, 2001, 2021,
     353, 349, 21, 103, 18, 46, 1873, 1, "2007", "retired",
     "'The Iceman'. Took the 2007 title at the last round by one point. Held the record for most race starts (349) until Alonso passed it.", "high"),
    ("hamilton", "Sir Lewis Hamilton", "United Kingdom", "GBR", "1985-01-07", None, 2007, None,
     None, 380, 106, 202, 104, 67, None, 7, "2008,2014,2015,2017,2018,2019,2020", "active",
     "Record holder for wins (105 at end-2025) and poles (104). Equalled Schumacher's title record in 2020. Moved to Ferrari for 2025 and took his first Ferrari win at Barcelona in 2026. Start/win totals move with the 2026 season.", "medium"),
    ("button", "Jenson Button", "United Kingdom", "GBR", "1980-01-19", None, 2000, 2017,
     309, 306, 15, 50, 8, 8, 1235, 1, "2009", "retired",
     "Won the 2009 title with Brawn GP in the team's only season.", "high"),
    ("vettel", "Sebastian Vettel", "Germany", "GER", "1987-07-03", None, 2007, 2022,
     300, 299, 53, 122, 57, 38, 3098, 4, "2010,2011,2012,2013", "retired",
     "Youngest ever World Champion at 23 (2010) and youngest four-time champion. Won a record nine consecutive races in 2013.", "high"),
    ("n-rosberg", "Nico Rosberg", "Germany", "GER", "1985-06-27", None, 2006, 2016,
     206, 206, 23, 57, 30, 20, 1594.5, 1, "2016", "retired",
     "Beat Hamilton by five points in 2016 and announced his retirement five days later. Son of 1982 champion Keke Rosberg.", "high"),
    ("verstappen", "Max Verstappen", "Netherlands", "NED", "1997-09-30", None, 2015, None,
     None, 230, 71, None, 45, 35, None, 4, "2021,2022,2023,2024", "active",
     "Youngest ever F1 starter at 17 and youngest winner at 18. Set single-season records for wins (19) and win percentage in 2023. Won 8 of 24 in 2025 but lost the title to Norris by two points.", "medium"),
    ("norris", "Lando Norris", "United Kingdom", "GBR", "1999-11-13", None, 2019, None,
     None, 155, 13, None, 15, 13, None, 1, "2025", "active",
     "A first win at Miami in 2024, then the 2025 title by two points from Verstappen with team-mate Piastri third.", "medium"),
]

# ---------------------------------------------------------------------
# Other Grand Prix winners and significant drivers.
# id, full_name, nationality, code, born, died, first, last, wins, poles,
# titles, status, notes, confidence
# ---------------------------------------------------------------------
OTHER_DRIVERS = [
    ("moss", "Sir Stirling Moss", "United Kingdom", "GBR", "1929-09-17", "2020-04-12", 1951, 1961, 16, 16, 0, "deceased",
     "Runner-up four consecutive years (1955-58) and third three times. Universally called the greatest driver never to win the championship.", "high"),
    ("gonzalez", "Jose Froilan Gonzalez", "Argentina", "ARG", "1922-10-05", "2013-06-15", 1950, 1960, 2, 3, 0, "deceased",
     "Gave Ferrari its first World Championship Grand Prix win, at Silverstone in 1951.", "high"),
    ("villoresi", "Luigi Villoresi", "Italy", "ITA", "1913-05-16", "1997-08-24", 1950, 1956, 0, 0, 0, "deceased",
     "Ascari's mentor and team-mate at Ferrari and Lancia.", "medium"),
    ("taruffi", "Piero Taruffi", "Italy", "ITA", "1906-10-12", "1988-01-12", 1950, 1956, 1, 0, 0, "deceased",
     "Won the 1952 Swiss GP; later won the final Mille Miglia in 1957.", "medium"),
    ("trintignant", "Maurice Trintignant", "France", "FRA", "1917-10-30", "2005-02-13", 1950, 1964, 2, 0, 0, "deceased",
     "Two Monaco wins, eight years apart (1955 and 1958).", "medium"),
    ("fagioli", "Luigi Fagioli", "Italy", "ITA", "1898-06-09", "1952-06-20", 1950, 1951, 1, 0, 0, "deceased",
     "Shared the 1951 French GP win with Fangio at 53, making him the oldest man to win a championship Grand Prix.", "high"),
    ("brooks", "Tony Brooks", "United Kingdom", "GBR", "1932-02-25", "2022-05-03", 1956, 1961, 6, 3, 0, "deceased",
     "A dentist by training; runner-up in 1959. Moss rated him the fastest of his contemporaries.", "medium"),
    ("collins", "Peter Collins", "United Kingdom", "GBR", "1931-11-06", "1958-08-03", 1952, 1958, 3, 0, 0, "deceased",
     "Handed his Ferrari to Fangio at Monza in 1956, giving up his own title chance. Killed at the Nurburgring two years later.", "medium"),
    ("musso", "Luigi Musso", "Italy", "ITA", "1924-07-28", "1958-07-06", 1953, 1958, 1, 0, 0, "deceased",
     "Killed at Reims in the 1958 French GP.", "medium"),
    ("bonnier", "Jo Bonnier", "Sweden", "SWE", "1930-01-31", "1972-06-11", 1956, 1971, 1, 1, 0, "deceased",
     "Gave BRM its first win at Zandvoort in 1959. First chairman of the Grand Prix Drivers' Association.", "medium"),
    ("mclaren-d", "Bruce McLaren", "New Zealand", "NZL", "1937-08-30", "1970-06-02", 1958, 1970, 4, 0, 0, "deceased",
     "Youngest GP winner for 44 years (1959 US GP, aged 22). Founded McLaren in 1963; killed testing a Can-Am car at Goodwood.", "high"),
    ("von-trips", "Wolfgang von Trips", "Germany", "GER", "1928-05-04", "1961-09-10", 1956, 1961, 2, 1, 0, "deceased",
     "Leading the 1961 championship when he was killed at Monza along with 15 spectators.", "high"),
    ("ireland", "Innes Ireland", "United Kingdom", "GBR", "1930-06-12", "1993-10-22", 1959, 1966, 1, 0, 0, "deceased",
     "Gave Team Lotus its first championship GP win, at Watkins Glen in 1961.", "medium"),
    ("ginther", "Richie Ginther", "United States", "USA", "1930-08-05", "1989-09-20", 1960, 1967, 1, 0, 0, "deceased",
     "Gave Honda its first Grand Prix victory, in Mexico in 1965.", "high"),
    ("gurney", "Dan Gurney", "United States", "USA", "1931-04-13", "2018-01-14", 1959, 1970, 4, 3, 0, "deceased",
     "Won a GP in a car of his own construction (Eagle, Spa 1967) — one of only two men to do so. Invented the Gurney flap and the podium champagne spray.", "high"),
    ("bandini", "Lorenzo Bandini", "Italy", "ITA", "1935-12-21", "1967-05-10", 1961, 1967, 1, 1, 0, "deceased",
     "Died from burns three days after crashing at the Monaco harbour chicane — a crash that drove home the sport's fire-safety failings.", "medium"),
    ("siffert", "Jo Siffert", "Switzerland", "SUI", "1936-07-07", "1971-10-24", 1962, 1971, 2, 2, 0, "deceased",
     "Killed in a non-championship race at Brands Hatch.", "medium"),
    ("scarfiotti", "Ludovico Scarfiotti", "Italy", "ITA", "1933-10-18", "1968-06-08", 1963, 1968, 1, 0, 0, "deceased",
     "Last Italian to win the Italian GP for Ferrari, in 1966.", "medium"),
    ("rodriguez-p", "Pedro Rodriguez", "Mexico", "MEX", "1940-01-18", "1971-07-11", 1963, 1971, 2, 0, 0, "deceased",
     "Won for Cooper and BRM; a legendary wet-weather driver.", "medium"),
    ("ickx", "Jacky Ickx", "Belgium", "BEL", "1945-01-01", None, 1966, 1979, 8, 13, 0, "retired",
     "Twice championship runner-up; six Le Mans wins. Protested the standing Le Mans start by walking to his car.", "high"),
    ("regazzoni", "Clay Regazzoni", "Switzerland", "SUI", "1939-09-05", "2006-12-15", 1970, 1980, 5, 5, 0, "deceased",
     "Gave Williams its first Grand Prix win at Silverstone in 1979. Paralysed in a crash at Long Beach in 1980.", "high"),
    ("cevert", "Francois Cevert", "France", "FRA", "1944-02-25", "1973-10-06", 1970, 1973, 1, 0, 0, "deceased",
     "Stewart's protege and designated successor at Tyrrell; killed in qualifying at Watkins Glen.", "high"),
    ("peterson", "Ronnie Peterson", "Sweden", "SWE", "1944-02-14", "1978-09-11", 1970, 1978, 10, 14, 0, "deceased",
     "Twice runner-up. Died of complications after a first-lap crash at Monza, a death that led directly to improved medical response.", "high"),
    ("revson", "Peter Revson", "United States", "USA", "1939-02-27", "1974-03-22", 1964, 1974, 2, 1, 0, "deceased",
     "Killed testing at Kyalami.", "medium"),
    ("reutemann", "Carlos Reutemann", "Argentina", "ARG", "1942-04-12", "2021-07-07", 1972, 1982, 12, 6, 0, "deceased",
     "Lost the 1981 title to Piquet by a point at the final round. Later governor of Santa Fe province.", "high"),
    ("depailler", "Patrick Depailler", "France", "FRA", "1944-08-09", "1980-08-01", 1972, 1980, 2, 1, 0, "deceased",
     "Killed testing at Hockenheim.", "medium"),
    ("mass", "Jochen Mass", "Germany", "GER", "1946-09-30", None, 1973, 1982, 1, 0, 0, "retired",
     "Won the shortened 1975 Spanish GP at Montjuic, stopped after a fatal accident.", "medium"),
    ("watson", "John Watson", "United Kingdom", "GBR", "1946-05-04", None, 1973, 1985, 5, 2, 0, "retired",
     "Won from 22nd on the grid at Long Beach in 1983 — still the lowest starting position for a winner.", "high"),
    ("nilsson", "Gunnar Nilsson", "Sweden", "SWE", "1948-11-20", "1978-10-20", 1976, 1977, 1, 0, 0, "deceased",
     "Won the 1977 Belgian GP; died of cancer at 29.", "medium"),
    ("laffite", "Jacques Laffite", "France", "FRA", "1943-11-21", None, 1974, 1986, 6, 7, 0, "retired",
     "Career ended by leg injuries in the 1986 British GP startline crash.", "medium"),
    ("jabouille", "Jean-Pierre Jabouille", "France", "FRA", "1942-10-01", "2023-02-02", 1974, 1981, 2, 6, 0, "deceased",
     "Won the first Grand Prix for a turbocharged car, at Dijon in 1979.", "high"),
    ("villeneuve-g", "Gilles Villeneuve", "Canada", "CAN", "1950-01-18", "1982-05-08", 1977, 1982, 6, 2, 0, "deceased",
     "Runner-up in 1979. Killed in qualifying at Zolder. Ferrari has never reissued his number 27 with the same reverence.", "high"),
    ("pironi", "Didier Pironi", "France", "FRA", "1952-03-26", "1987-08-23", 1978, 1982, 3, 4, 0, "deceased",
     "Leading the 1982 championship when leg injuries at Hockenheim ended his career; killed powerboat racing five years later.", "high"),
    ("arnoux", "Rene Arnoux", "France", "FRA", "1948-07-04", None, 1978, 1989, 7, 18, 0, "retired",
     "His 1979 Dijon duel with Villeneuve is among the most replayed pieces of footage in the sport.", "medium"),
    ("de-angelis", "Elio de Angelis", "Italy", "ITA", "1958-03-26", "1986-05-15", 1979, 1986, 2, 3, 0, "deceased",
     "Killed testing at Paul Ricard, where the absence of marshals and medical cover caused an outcry.", "high"),
    ("tambay", "Patrick Tambay", "France", "FRA", "1949-06-25", "2022-12-04", 1977, 1986, 2, 5, 0, "deceased",
     "Took over Villeneuve's Ferrari seat and won at Hockenheim weeks later.", "medium"),
    ("alboreto", "Michele Alboreto", "Italy", "ITA", "1956-12-23", "2001-04-25", 1981, 1994, 5, 2, 0, "deceased",
     "Ferrari's last Italian championship contender, runner-up in 1985. Killed testing an Audi at the Lausitzring.", "high"),
    ("patrese", "Riccardo Patrese", "Italy", "ITA", "1954-04-17", None, 1977, 1993, 6, 8, 0, "retired",
     "Held the record for most Grand Prix starts when he retired; runner-up in 1992.", "high"),
    ("berger", "Gerhard Berger", "Austria", "AUT", "1959-08-27", None, 1984, 1997, 10, 12, 0, "retired",
     "Won for Benetton, Ferrari and McLaren across three decades of regulations. Survived a fiery crash at Imola in 1989.", "high"),
    ("boutsen", "Thierry Boutsen", "Belgium", "BEL", "1957-07-13", None, 1983, 1993, 3, 1, 0, "retired",
     "All his wins came for Williams in 1989-90, two of them in torrential rain.", "medium"),
    ("nannini", "Alessandro Nannini", "Italy", "ITA", "1959-07-07", None, 1986, 1990, 1, 0, 0, "retired",
     "Won the 1989 Japanese GP after Senna's disqualification; lost an arm in a helicopter crash in 1990 (later reattached).", "medium"),
    ("alesi", "Jean Alesi", "France", "FRA", "1964-06-11", None, 1989, 2001, 1, 2, 0, "retired",
     "His only win was the 1995 Canadian GP, on his birthday, in a Ferrari.", "high"),
    ("herbert", "Johnny Herbert", "United Kingdom", "GBR", "1964-06-25", None, 1989, 2000, 3, 0, 0, "retired",
     "Raced on after career-threatening foot injuries in F3000; later an FIA steward.", "medium"),
    ("panis", "Olivier Panis", "France", "FRA", "1966-09-02", None, 1994, 2004, 1, 0, 0, "retired",
     "Won the chaotic 1996 Monaco GP from 14th, with only three cars classified.", "high"),
    ("frentzen", "Heinz-Harald Frentzen", "Germany", "GER", "1967-05-18", None, 1994, 2003, 3, 2, 0, "retired",
     "Championship runner-up in 1997 and third in 1999 with Jordan.", "medium"),
    ("irvine", "Eddie Irvine", "United Kingdom", "GBR", "1965-11-10", None, 1993, 2002, 4, 0, 0, "retired",
     "Lost the 1999 title to Hakkinen by two points while deputising for the injured Schumacher.", "high"),
    ("coulthard", "David Coulthard", "United Kingdom", "GBR", "1971-03-27", None, 1994, 2008, 13, 12, 0, "retired",
     "Runner-up in 2001; the most successful Scottish driver after Clark and Stewart.", "high"),
    ("barrichello", "Rubens Barrichello", "Brazil", "BRA", "1972-05-23", None, 1993, 2011, 11, 14, 0, "retired",
     "Held the record for most starts until Raikkonen. Twice runner-up to Schumacher at Ferrari.", "high"),
    ("r-schumacher", "Ralf Schumacher", "Germany", "GER", "1975-06-30", None, 1997, 2007, 6, 6, 0, "retired",
     "Michael's younger brother; the pair finished 1-2 at the 2001 Canadian GP.", "medium"),
    ("montoya", "Juan Pablo Montoya", "Colombia", "COL", "1975-09-20", None, 2001, 2006, 7, 13, 0, "retired",
     "Won the Indianapolis 500 and CART title before F1, and passed Schumacher around the outside on his fourth GP start.", "high"),
    ("trulli", "Jarno Trulli", "Italy", "ITA", "1974-07-13", None, 1997, 2011, 1, 4, 0, "retired",
     "Won Monaco in 2004. The 'Trulli train' entered the sport's vocabulary.", "medium"),
    ("fisichella", "Giancarlo Fisichella", "Italy", "ITA", "1973-01-14", None, 1996, 2009, 3, 4, 0, "retired",
     "Took Force India's only pole and podium at Spa in 2009.", "medium"),
    ("massa", "Felipe Massa", "Brazil", "BRA", "1981-04-25", None, 2002, 2017, 11, 16, 0, "retired",
     "Lost the 2008 title by one point at his home race, having crossed the line as champion for 38 seconds. Suffered a fractured skull at the Hungaroring in 2009.", "high"),
    ("webber", "Mark Webber", "Australia", "AUS", "1976-08-27", None, 2002, 2013, 9, 13, 0, "retired",
     "Championship runner-up in 2010; later won the World Endurance Championship with Porsche.", "high"),
    ("kubica", "Robert Kubica", "Poland", "POL", "1984-12-07", None, 2006, 2021, 1, 1, 0, "retired",
     "Poland's only GP winner (Canada 2008). Returned to F1 in 2019 after a rally crash partially severed his forearm.", "high"),
    ("kovalainen", "Heikki Kovalainen", "Finland", "FIN", "1981-10-19", None, 2007, 2013, 1, 1, 0, "retired",
     "Won the 2008 Hungarian GP for McLaren.", "medium"),
    ("maldonado", "Pastor Maldonado", "Venezuela", "VEN", "1985-03-09", None, 2011, 2015, 1, 1, 0, "retired",
     "Williams's only win between 2004 and 2012, at Barcelona in 2012.", "high"),
    ("ricciardo", "Daniel Ricciardo", "Australia", "AUS", "1989-07-01", None, 2011, 2024, 8, 3, 0, "retired",
     "Won for Red Bull and McLaren, several times from improbable positions.", "high"),
    ("bottas", "Valtteri Bottas", "Finland", "FIN", "1989-08-28", None, 2013, None, 10, 20, 0, "active",
     "Championship runner-up as Hamilton's Mercedes team-mate. Returned to a race seat with Cadillac in 2026.", "high"),
    ("perez", "Sergio Perez", "Mexico", "MEX", "1990-01-26", None, 2011, None, 6, 3, 0, "active",
     "Won Monaco in 2022; runner-up in 2023. Returned with Cadillac in 2026.", "high"),
    ("gasly", "Pierre Gasly", "France", "FRA", "1996-02-07", None, 2017, None, 1, 0, 0, "active",
     "Won the 2020 Italian GP for AlphaTauri, the team's second and last victory.", "high"),
    ("ocon", "Esteban Ocon", "France", "FRA", "1996-09-17", None, 2016, None, 1, 0, 0, "active",
     "Won the 2021 Hungarian GP for Alpine.", "high"),
    ("leclerc", "Charles Leclerc", "Monaco", "MON", "1997-10-16", None, 2018, None, 9, 26, 0, "active",
     "Ferrari's lead driver since 2019; won his home Monaco Grand Prix in 2024. Championship runner-up in 2022.", "medium"),
    ("sainz", "Carlos Sainz", "Spain", "ESP", "1994-09-01", None, 2015, None, 4, 6, 0, "active",
     "Won for Ferrari at Silverstone 2022, Singapore 2023 and Melbourne 2024. Son of the double World Rally Champion.", "medium"),
    ("russell", "George Russell", "United Kingdom", "GBR", "1998-02-15", None, 2019, None, 7, 6, 0, "active",
     "First win at Interlagos 2022. Won twice in 2025 and again in Australia and Austria in 2026. GPDA director.", "medium"),
    ("piastri", "Oscar Piastri", "Australia", "AUS", "2001-04-06", None, 2023, None, 9, 6, 0, "active",
     "Won races in 2025 and finished third in the championship.", "medium"),
    ("antonelli", "Andrea Kimi Antonelli", "Italy", "ITA", "2006-08-25", None, 2025, None, 6, None, 0, "active",
     "Promoted to Mercedes at 18 to replace Hamilton. Leads the 2026 championship.", "medium"),
    ("hulkenberg", "Nico Hulkenberg", "Germany", "GER", "1987-08-19", None, 2010, None, 0, 1, 0, "active",
     "Took pole for Williams in 2010; a first podium came at Silverstone in 2025. Won Le Mans outright in 2015.", "medium"),
    ("albon", "Alexander Albon", "Thailand", "THA", "1996-03-23", None, 2019, None, 0, 0, 0, "active",
     "Podiums with Red Bull in 2020; Williams's lead driver since 2022.", "medium"),
    ("stroll", "Lance Stroll", "Canada", "CAN", "1998-10-29", None, 2017, None, 0, 1, 0, "active",
     "Front row at Monza in 2017; pole at Istanbul in 2020.", "medium"),
    ("tsunoda", "Yuki Tsunoda", "Japan", "JPN", "2000-05-11", None, 2021, None, 0, 0, 0, "active",
     "Promoted to Red Bull for 2025; reserve and substitute duties with Racing Bulls in 2026.", "medium"),
    ("hadjar", "Isack Hadjar", "France", "FRA", "2004-09-28", None, 2025, None, 0, 0, 0, "active",
     "Rookie of 2025 with Racing Bulls; promoted to Red Bull alongside Verstappen for 2026.", "medium"),
    ("lawson", "Liam Lawson", "New Zealand", "NZL", "2002-02-11", None, 2023, None, 0, 0, 0, "active",
     "Racing Bulls race driver in 2026 after a brief 2025 stint at Red Bull.", "medium"),
    ("bearman", "Oliver Bearman", "United Kingdom", "GBR", "2005-05-08", None, 2024, None, 0, 0, 0, "active",
     "Scored on debut standing in for Sainz at Ferrari in Jeddah 2024; Haas race driver since 2025.", "medium"),
    ("colapinto", "Franco Colapinto", "Argentina", "ARG", "2003-05-27", None, 2024, None, 0, 0, 0, "active",
     "Argentina's first F1 racer since 2001; Alpine race driver in 2026.", "medium"),
    ("bortoleto", "Gabriel Bortoleto", "Brazil", "BRA", "2004-10-14", None, 2025, None, 0, 0, 0, "active",
     "F3 and F2 champion in consecutive years before reaching F1 with Sauber, now Audi.", "medium"),
    ("lindblad", "Arvid Lindblad", "United Kingdom", "GBR", "2007-08-08", None, 2026, None, 0, 0, 0, "active",
     "Red Bull junior promoted to Racing Bulls for 2026.", "medium"),
    ("doohan", "Jack Doohan", "Australia", "AUS", "2003-01-20", None, 2024, 2025, 0, 0, 0, "retired",
     "Alpine race driver at the start of 2025. Son of five-time 500cc champion Mick Doohan.", "medium"),
    ("grosjean", "Romain Grosjean", "France", "FRA", "1986-04-17", None, 2009, 2020, 0, 0, 0, "retired",
     "Survived a 67 g impact and 28 seconds in the fire at Bahrain in 2020 — the crash that vindicated the halo.", "high"),
    ("bianchi", "Jules Bianchi", "France", "FRA", "1989-08-03", "2015-07-17", 2013, 2014, 0, 0, 0, "deceased",
     "Scored Marussia's only points. Died from injuries sustained at Suzuka in 2014, the first F1 fatality from an on-track accident since 1994; his death led to the virtual safety car and the halo programme.", "high"),
    ("de-villota", "Maria de Villota", "Spain", "ESP", "1980-01-13", "2013-10-11", None, None, 0, 0, 0, "deceased",
     "Marussia test driver; sustained fatal-course injuries in a straight-line test accident in 2012.", "medium"),
    ("wolff-s", "Susie Wolff", "United Kingdom", "GBR", "1982-12-06", None, None, None, 0, 0, 0, "retired",
     "Williams development driver; first woman to take part in an F1 race weekend in 22 years (2014). Managing Director of F1 Academy.", "medium"),
    ("lombardi", "Lella Lombardi", "Italy", "ITA", "1941-03-26", "1992-03-03", 1974, 1976, 0, 0, 0, "deceased",
     "The only woman to score in a World Championship Grand Prix — half a point for sixth at the shortened 1975 Spanish GP.", "high"),
]

INDY_NOTE = (
    "The Indianapolis 500 counted towards the World Championship from 1950 to 1960. "
    "Its winners (Parsons, Wallard, Ruttman, Vukovich x2, Sweikert, Flaherty, Hanks, "
    "Bryan, Ward, Rathmann) are therefore World Championship race winners in the "
    "official record, though almost none of them contested a European Grand Prix. "
    "They are recorded here as a class rather than as individual driver rows."
)


# ---------------------------------------------------------------------
# Career statistics checked directly against the official formula1.com
# driver pages on 2026-09-04 (after round 12 of the 2026 season).
# These override whatever the tuples above hold, and are marked
# confidence='verified' on load.
#   id: (entries, starts, wins, podiums, poles, points)
# ---------------------------------------------------------------------
STATS_AS_OF = "2026-09-04, after round 12 of the 2026 season"

VERIFIED_STATS = {
    "hamilton":   (392, None, 106, 207, 104, 5201.5),
    "verstappen": (245, None, 71, 131, 48, 3556.5),
    "alonso":     (439, None, 32, 106, 22, 2396),
    "norris":     (163, None, 13, 48, 18, 1589),
    "leclerc":    (183, None, 9, 54, 27, 1827),
    "russell":    (163, None, 7, 29, 12, 1193),
    "piastri":    (80, None, 9, 28, 6, 903),
}

# Antonelli's career totals are not separately published in a form worth
# copying yet; his 2026 figures (6 wins, 10 podiums, 6 poles, 242 points
# after 12 rounds) are held in the standings and race_results tables.

# ---------------------------------------------------------------------
# Drivers admitted from the F1DB register.
#
# 616 people who entered a championship Grand Prix and had no row here. The
# register held 244 of roughly 860, which made it the binding constraint on
# everything downstream: tools/ergast_load.py skipped 5,490 classification
# rows because the driver could not be resolved, and it refuses to invent
# one. Pierluigi Martini entered 124 Grands Prix, Philippe Alliot 116,
# Piercarlo Ghinzani 111. None of them existed in this database.
#
# What is authored and what is not
# --------------------------------
# The IDS below are the register decision, one per line, with the seasons
# and entry count that justify each. The ATTRIBUTES - name, nationality,
# date of birth, date of death - are read at build time from
# harvest/f1db_drivers.txt, and first/last season from the entry lists.
# Nobody types six hundred names. This is the same split the constructor
# register uses.
#
# Why Indianapolis drivers ARE admitted, when Indianapolis constructors are not
# ----------------------------------------------------------------------------
# 73 of these entered nothing but the Indianapolis 500 in the years it
# counted. The constructor register excludes the Indianapolis CHASSIS MAKERS
# - Kuzma, Watson, Epperly - because they were never Formula One
# constructors and giving them rows would put roadsters into the constructor
# statistics.
#
# Drivers are the opposite case, and this project already decided it: the ten
# Indianapolis winners in harvest.py INDY_WINNERS have been in the register
# since v2.1, on the grounds that the official record counts an Indianapolis
# start in 1950-60 as a World Championship start. Johnnie Parsons and Lee
# Wallard never contested a European Grand Prix and are here. Excluding the
# other 73 would contradict that, so the test is simply: did the driver enter
# a championship race.
#
# Career figures are NULL, which build.py reads as "derive from the race
# records". `entries` and `starts` stay NULL too and that is not laziness:
# F1DB's round ranges say a driver was ENTERED for those rounds, which is not
# the same as having started, and this database does not blur the two.
# ---------------------------------------------------------------------
F1DB_DRIVERS = [
    "alfredo-pian",                    # 1950          1             Alfredo Pián
    "bayliss-levrett",                 # 1950          1  Indy only  Bayliss Levrett
    "bill-cantrell",                   # 1950          1  Indy only  Bill Cantrell
    "bill-schindler",                  # 1950-1952     3  Indy only  Bill Schindler
    "birabongse-bhanudej",             # 1950-1954    19             Birabongse Bhanudej
    "bob-gerard",                      # 1950-1957     8             Bob Gerard
    "brian-shawe-taylor",              # 1950-1951     2             Brian Shawe-Taylor
    "cecil-green",                     # 1950-1951     2  Indy only  Cecil Green
    "charles-pozzi",                   # 1950          1             Charles Pozzi
    "clemente-biondetti",              # 1950          1             Clemente Biondetti
    "consalvo-sanesi",                 # 1950-1951     5             Consalvo Sanesi
    "cuth-harrison",                   # 1950          3             Cuth Harrison
    "david-hampshire",                 # 1950          2             David Hampshire
    "david-murray",                    # 1950-1952     5             David Murray
    "duke-dinsmore",                   # 1950-1956     4  Indy only  Duke Dinsmore
    "emmanuel-de-graffenried",         # 1950-1956    23             Emmanuel de Graffenried
    "eugene-chaboud",                  # 1950-1951     3             Eugène Chaboud
    "eugene-martin",                   # 1950          2             Eugène Martin
    "franco-comotti",                  # 1950-1952     2             Franco Comotti
    "franco-rol",                      # 1950-1952     5             Franco Rol
    "gene-hartley",                    # 1950-1960     8  Indy only  Gene Hartley
    "geoffrey-crossley",               # 1950          2             Geoffrey Crossley
    "george-connor",                   # 1950-1952     3  Indy only  George Connor
    "guy-mairesse",                    # 1950-1951     3             Guy Mairesse
    "henri-louveau",                   # 1950-1951     2             Henri Louveau
    "henry-banks",                     # 1950-1952     3  Indy only  Henry Banks
    "jackie-holmes",                   # 1950-1953     2  Indy only  Jackie Holmes
    "jimmy-jackson",                   # 1950-1954     2  Indy only  Jimmy Jackson
    "joe-fry",                         # 1950          1             Joe Fry
    "joe-kelly",                       # 1950-1951     2             Joe Kelly
    "johnny-claes",                    # 1950-1955    25             Johnny Claes
    "johnny-mcdowell",                 # 1950-1952     3  Indy only  Johnny McDowell
    "joie-chitwood",                   # 1950          1  Indy only  Joie Chitwood
    "leslie-johnson",                  # 1950          1             Leslie Johnson
    "mack-hellings",                   # 1950-1951     2  Indy only  Mack Hellings
    "myron-fohr",                      # 1950          1  Indy only  Myron Fohr
    "nello-pagani",                    # 1950          1             Nello Pagani
    "paul-pietsch",                    # 1950-1952     3             Paul Pietsch
    "peter-walker",                    # 1950-1955     4             Peter Walker
    "philippe-etancelin",              # 1950-1952    12             Philippe Étancelin
    "pierre-levegh",                   # 1950-1951     6             Pierre Levegh
    "raymond-sommer",                  # 1950          5             Raymond Sommer
    "spider-webb",                     # 1950-1954     4  Indy only  Spider Webb
    "toni-branca",                     # 1950-1951     3             Toni Branca
    "tony-rolt",                       # 1950-1955     3             Tony Rolt
    "walt-ader",                       # 1950          1  Indy only  Walt Ader
    "walt-brown",                      # 1950-1951     2  Indy only  Walt Brown
    "yves-giraud-cabantous",           # 1950-1953    13             Yves Giraud-Cabantous
    "aldo-gordini",                    # 1951          1             Aldo Gordini
    "andre-pilette",                   # 1951-1964    14             André Pilette
    "andre-simon",                     # 1951-1957    12             André Simon
    "andy-linden",                     # 1951-1957     7  Indy only  Andy Linden
    "bill-mackey",                     # 1951          1  Indy only  Bill Mackey
    "bobby-ball",                      # 1951-1952     2  Indy only  Bobby Ball
    "carl-forberg",                    # 1951          1  Indy only  Carl Forberg
    "carl-scarborough",                # 1951-1953     2  Indy only  Carl Scarborough
    "chet-miller",                     # 1951-1952     2  Indy only  Chet Miller
    "chico-landi",                     # 1951-1956     6             Chico Landi
    "chuck-stevenson",                 # 1951-1960     5  Indy only  Chuck Stevenson
    "cliff-griffith",                  # 1951-1956     3  Indy only  Cliff Griffith
    "duncan-hamilton",                 # 1951-1953     5             Duncan Hamilton
    "gene-force",                      # 1951-1960     2  Indy only  Gene Force
    "george-abecassis",                # 1951-1952     2             George Abecassis
    "georges-grignard",                # 1951          1             Georges Grignard
    "hans-stuck",                      # 1951-1953     5             Hans Stuck
    "jacques-swaters",                 # 1951-1954     8             Jacques Swaters
    "joe-james",                       # 1951-1952     2  Indy only  Joe James
    "john-james",                      # 1951          1             John James
    "juan-jover",                      # 1951          1             Juan Jover
    "ken-richardson",                  # 1951          1             Ken Richardson
    "paco-godia",                      # 1951-1958    14             Paco Godia
    "peter-hirt",                      # 1951-1953     5             Peter Hirt
    "philip-fotheringham-parker",      # 1951          1             Philip Fotheringham-Parker
    "adolf-brudes",                    # 1952          1             Adolf Brudes
    "alan-brown",                      # 1952-1954     9             Alan Brown
    "alberto-crespo",                  # 1952          1             Alberto Crespo
    "arthur-legat",                    # 1952-1953     2             Arthur Legat
    "bill-aston",                      # 1952          3             Bill Aston
    "bob-scott",                       # 1952-1954     3  Indy only  Bob Scott
    "charles-de-tornaco",              # 1952-1953     4             Charles de Tornaco
    "dennis-poore",                    # 1952          2             Dennis Poore
    "dries-van-der-lof",               # 1952          1             Dries van der Lof
    "eddie-johnson",                   # 1952-1960     9  Indy only  Eddie Johnson
    "eitel-cantoni",                   # 1952          3             Eitel Cantoni
    "elie-bayol",                      # 1952-1956     8             Élie Bayol
    "eric-brandon",                    # 1952-1954     5             Eric Brandon
    "eric-thompson",                   # 1952          1             Eric Thompson
    "ernst-klodwig",                   # 1952-1953     2             Ernst Klodwig
    "fritz-riess",                     # 1952          1             Fritz Riess
    "george-fonder",                   # 1952-1954     2  Indy only  George Fonder
    "gino-bianco",                     # 1952          4             Gino Bianco
    "graham-whitehead",                # 1952          1             Graham Whitehead
    "hans-klenk",                      # 1952          1             Hans Klenk
    "harry-merkel",                    # 1952          1             Harry Merkel
    "helmut-niedermayr",               # 1952          1             Helmut Niedermayr
    "jan-flinterman",                  # 1952          1             Jan Flinterman
    "jim-rigsby",                      # 1952          1  Indy only  Jim Rigsby
    "jimmy-reece",                     # 1952-1958     6  Indy only  Jimmy Reece
    "josef-peters",                    # 1952          1             Josef Peters
    "karl-gunther-bechem",             # 1952-1953     2             Karl-Günther Bechem
    "ken-downing",                     # 1952          2             Ken Downing
    "ken-wharton",                     # 1952-1955    16             Ken Wharton
    "kenneth-mcalpine",                # 1952-1955     7             Kenneth McAlpine
    "lance-macklin",                   # 1952-1955    15             Lance Macklin
    "ludwig-fischer",                  # 1952          1             Ludwig Fischer
    "marcel-balsa",                    # 1952          1             Marcel Balsa
    "max-de-terra",                    # 1952-1953     2             Max de Terra
    "piero-carini",                    # 1952-1953     3             Piero Carini
    "piero-dusio",                     # 1952          1             Piero Dusio
    "robert-obrien",                   # 1952          1             Robert O'Brien
    "robin-montgomerie-charrington",   # 1952          1             Robin Montgomerie-Charrington
    "roger-laurent",                   # 1952          2             Roger Laurent
    "rudolf-krause",                   # 1952-1953     2             Rudolf Krause
    "rudolf-schoeller",                # 1952          1             Rudolf Schoeller
    "theo-helfrich",                   # 1952-1954     3             Theo Helfrich
    "toni-ulmen",                      # 1952          2             Toni Ulmen
    "tony-crook",                      # 1952-1953     2             Tony Crook
    "tony-gaze",                       # 1952          4             Tony Gaze
    "willi-heeks",                     # 1952-1953     2             Willi Heeks
    "willi-krakau",                    # 1952          1             Willi Krakau
    "adolfo-schwelm-cruz",             # 1953          1             Adolfo Schwelm Cruz
    "albert-scherrer",                 # 1953          1             Albert Scherrer
    "cal-niday",                       # 1953-1955     3  Indy only  Cal Niday
    "edgar-barth",                     # 1953-1964     5             Edgar Barth
    "ernie-mccoy",                     # 1953-1954     2  Indy only  Ernie McCoy
    "ernst-loof",                      # 1953          1             Ernst Loof
    "erwin-bauer",                     # 1953          1             Erwin Bauer
    "fred-wacker",                     # 1953-1954     5             Fred Wacker
    "georges-berger",                  # 1953-1954     2             Georges Berger
    "helm-glockler",                   # 1953          1             Helm Glöckler
    "hermann-lang",                    # 1953-1954     2             Hermann Lang
    "ian-stewart",                     # 1953          1             Ian Stewart
    "jack-fairman",                    # 1953-1961    13             Jack Fairman
    "jimmy-daywalt",                   # 1953-1959     6  Indy only  Jimmy Daywalt
    "jimmy-stewart",                   # 1953          1             Jimmy Stewart
    "john-barber",                     # 1953          1             John Barber
    "john-fitch",                      # 1953-1955     2             John Fitch
    "johnny-mantz",                    # 1953          1  Indy only  Johnny Mantz
    "kurt-adolff",                     # 1953          1             Kurt Adolff
    "marshall-teague",                 # 1953-1957     3  Indy only  Marshall Teague
    "oscar-alfredo-galvez",            # 1953          1             Oscar Alfredo Gálvez
    "oswald-karch",                    # 1953          1             Oswald Karch
    "pablo-birger",                    # 1953-1955     2             Pablo Birger
    "rodney-nuckey",                   # 1953-1954     2             Rodney Nuckey
    "sergio-mantovani",                # 1953-1955     8             Sergio Mantovani
    "theo-fitzau",                     # 1953          1             Theo Fitzau
    "wolfgang-seidel",                 # 1953-1962    13             Wolfgang Seidel
    "bill-homeier",                    # 1954-1960     3  Indy only  Bill Homeier
    "bill-whitehouse",                 # 1954          1             Bill Whitehouse
    "clemar-bucci",                    # 1954-1955     5             Clemar Bucci
    "danny-kladis",                    # 1954          1  Indy only  Danny Kladis
    "don-beauman",                     # 1954          1             Don Beauman
    "ed-elisian",                      # 1954-1958     5  Indy only  Ed Elisian
    "frank-armi",                      # 1954          1  Indy only  Frank Armi
    "giovanni-de-riu",                 # 1954          1             Giovanni de Riu
    "horace-gould",                    # 1954-1960    18             Horace Gould
    "jacques-pollet",                  # 1954-1955     5             Jacques Pollet
    "john-riseley-prichard",           # 1954          1             John Riseley-Prichard
    "jorge-daponte",                   # 1954          2             Jorge Daponte
    "larry-crockett",                  # 1954          1  Indy only  Larry Crockett
    "len-duncan",                      # 1954          1  Indy only  Len Duncan
    "leslie-marr",                     # 1954-1955     2             Leslie Marr
    "leslie-thorne",                   # 1954          1             Leslie Thorne
    "ottorino-volonterio",             # 1954-1957     3             Ottorino Volonterio
    "roger-loyer",                     # 1954          1             Roger Loyer
    "al-herman",                       # 1955-1960     5  Indy only  Al Herman
    "al-keller",                       # 1955-1959     5  Indy only  Al Keller
    "alberto-uria",                    # 1955-1956     2             Alberto Uria
    "chuck-weyant",                    # 1955-1959     4  Indy only  Chuck Weyant
    "eddie-russo",                     # 1955-1960     4  Indy only  Eddie Russo
    "hermano-da-silva-ramos",          # 1955-1956     7             Hermano da Silva Ramos
    "jean-lucas",                      # 1955          1             Jean Lucas
    "jesus-iglesias",                  # 1955          1             Jesús Iglesias
    "keith-andrews",                   # 1955-1956     2  Indy only  Keith Andrews
    "luigi-piotti",                    # 1955-1958     9             Luigi Piotti
    "mike-sparken",                    # 1955          1             Mike Sparken
    "ray-crawford",                    # 1955-1959     3  Indy only  Ray Crawford
    "shorty-templeman",                # 1955-1960     3  Indy only  Shorty Templeman
    "ted-whiteaway",                   # 1955          1             Ted Whiteaway
    "andre-milhoux",                   # 1956          1             André Milhoux
    "archie-scott-brown",              # 1956          1             Archie Scott Brown
    "billy-garrett",                   # 1956-1958     2  Indy only  Billy Garrett
    "bob-christie",                    # 1956-1960     5  Indy only  Bob Christie
    "bob-veith",                       # 1956-1960     5  Indy only  Bob Veith
    "bruce-halford",                   # 1956-1960     9             Bruce Halford
    "colin-chapman",                   # 1956          1             Colin Chapman
    "desmond-titterington",            # 1956          1             Desmond Titterington
    "gerino-gerini",                   # 1956-1958     7             Gerino Gerini
    "giorgio-scarlatti",               # 1956-1961    15             Giorgio Scarlatti
    "jack-turner",                     # 1956-1959     4  Indy only  Jack Turner
    "johnnie-tolan",                   # 1956-1958     3  Indy only  Johnnie Tolan
    "les-leston",                      # 1956-1957     3             Les Leston
    "oscar-gonzalez",                  # 1956          1             Óscar González
    "paul-emery",                      # 1956-1958     2             Paul Emery
    "piero-scotti",                    # 1956          1             Piero Scotti
    "alejandro-de-tomaso",             # 1957-1959     2             Alejandro de Tomaso
    "bill-cheesbourg",                 # 1957-1959     3  Indy only  Bill Cheesbourg
    "brian-naylor",                    # 1957-1961     8             Brian Naylor
    "carel-godin-de-beaufort",         # 1957-1964    31             Carel Godin de Beaufort
    "dick-gibson",                     # 1957-1958     2             Dick Gibson
    "don-edmunds",                     # 1957          1  Indy only  Don Edmunds
    "elmer-george",                    # 1957          1  Indy only  Elmer George
    "herbert-mackay-fraser",           # 1957          1             Herbert MacKay-Fraser
    "ivor-bueb",                       # 1957-1959     6             Ivor Bueb
    "mike-macdowel",                   # 1957          1             Mike MacDowel
    "mike-magill",                     # 1957-1959     3  Indy only  Mike Magill
    "paul-england",                    # 1957          1             Paul England
    "tony-marsh",                      # 1957-1961     5             Tony Marsh
    "alan-stacey",                     # 1958-1960     7             Alan Stacey
    "andre-guelfi",                    # 1958          1             André Guelfi
    "andre-testut",                    # 1958-1959     2             André Testut
    "anthony-joseph-foyt",             # 1958-1960     3  Indy only  Anthony Joseph Foyt
    "art-bisch",                       # 1958          1  Indy only  Art Bisch
    "bernie-ecclestone",               # 1958          2             Bernie Ecclestone
    "bruce-kessler",                   # 1958          1             Bruce Kessler
    "carroll-shelby",                  # 1958-1959     8             Carroll Shelby
    "christian-goethals",              # 1958          1             Christian Goethals
    "dempsey-wilson",                  # 1958-1960     2  Indy only  Dempsey Wilson
    "francois-picard",                 # 1958          1             François Picard
    "giulio-cabianca",                 # 1958-1960     4             Giulio Cabianca
    "ian-burgess",                     # 1958-1963    20             Ian Burgess
    "jerry-unser-jr",                  # 1958          1  Indy only  Jerry Unser Jr.
    "jud-larson",                      # 1958-1959     2  Indy only  Jud Larson
    "ken-kavanagh",                    # 1958          2             Ken Kavanagh
    "len-sutton",                      # 1958-1960     3  Indy only  Len Sutton
    "luigi-taramazzo",                 # 1958          1             Luigi Taramazzo
    "maria-teresa-de-filippis",        # 1958-1959     5             Maria Teresa de Filippis
    "robert-la-caze",                  # 1958          1             Robert La Caze
    "tom-bridger",                     # 1958          1             Tom Bridger
    "alain-de-changy",                 # 1959          1             Alain de Changy
    "asdrubal-fontes-bayardo",         # 1959          1             Asdrúbal Fontes Bayardo
    "bill-moss",                       # 1959          1             Bill Moss
    "bob-said",                        # 1959          1             Bob Said
    "bobby-grim",                      # 1959-1960     2  Indy only  Bobby Grim
    "chris-bristow",                   # 1959-1960     4             Chris Bristow
    "chuck-arnold",                    # 1959          1  Indy only  Chuck Arnold
    "colin-davis",                     # 1959          2             Colin Davis
    "david-piper",                     # 1959-1960     3             David Piper
    "dennis-taylor",                   # 1959          1             Dennis Taylor
    "don-branson",                     # 1959-1960     2  Indy only  Don Branson
    "fritz-dorey",                     # 1959          3             Fritz d'Orey
    "george-constantine",              # 1959          1             George Constantine
    "harry-blanchard",                 # 1959          1             Harry Blanchard
    "henry-taylor",                    # 1959-1961    11             Henry Taylor
    "jean-lucienbonnet",               # 1959          1             Jean Lucienbonnet
    "jim-mcwithey",                    # 1959-1960     2  Indy only  Jim McWithey
    "keith-greene",                    # 1959-1962     5             Keith Greene
    "lucien-bianchi",                  # 1959-1968    19             Lucien Bianchi
    "mario-de-araujo-cabral",          # 1959-1964     5             Mário de Araújo Cabral
    "mike-taylor",                     # 1959-1960     2             Mike Taylor
    "pete-lovely",                     # 1959-1971    11             Pete Lovely
    "peter-ashdown",                   # 1959          1             Peter Ashdown
    "phil-cade",                       # 1959          1             Phil Cade
    "red-amick",                       # 1959-1960     2  Indy only  Red Amick
    "tim-parnell",                     # 1959-1963     4             Tim Parnell
    "alberto-rodriguez-larreta",       # 1960          1             Alberto Rodriguez Larreta
    "alfonso-thiele",                  # 1960          1             Alfonso Thiele
    "antonio-creus",                   # 1960          1             Antonio Creus
    "arthur-owen",                     # 1960          1             Arthur Owen
    "bob-drake",                       # 1960          1             Bob Drake
    "bud-tingelstad",                  # 1960          1  Indy only  Bud Tingelstad
    "chuck-daigh",                     # 1960          6             Chuck Daigh
    "ettore-chimeri",                  # 1960          1             Ettore Chimeri
    "fred-gamble",                     # 1960          1             Fred Gamble
    "gino-munaron",                    # 1960          5             Gino Munaron
    "jim-hall",                        # 1960-1963    12             Jim Hall
    "jim-hurtubise",                   # 1960          1  Indy only  Jim Hurtubise
    "lance-reventlow",                 # 1960          4             Lance Reventlow
    "lloyd-ruby",                      # 1960-1961     2             Lloyd Ruby
    "nasif-estefano",                  # 1960-1962     2             Nasif Estéfano
    "piero-drogo",                     # 1960          1             Piero Drogo
    "roberto-bonomi",                  # 1960          1             Roberto Bonomi
    "vic-wilson",                      # 1960-1966     2             Vic Wilson
    "wayne-weiler",                    # 1960          1  Indy only  Wayne Weiler
    "bernard-collomb",                 # 1961-1964     6             Bernard Collomb
    "gaetano-starrabba",               # 1961          1             Gaetano Starrabba
    "gerry-ashmore",                   # 1961-1962     4             Gerry Ashmore
    "hap-sharp",                       # 1961-1964     6             Hap Sharp
    "jackie-lewis",                    # 1961-1962    10             Jackie Lewis
    "juan-manuel-bordeu",              # 1961          1             Juan Manuel Bordeu
    "massimo-natili",                  # 1961          2             Massimo Natili
    "michael-may",                     # 1961          3             Michael May
    "nino-vaccarella",                 # 1961-1965     5             Nino Vaccarella
    "peter-ryan",                      # 1961          1             Peter Ryan
    "renato-pirocchi",                 # 1961          1             Renato Pirocchi
    "ricardo-rodriguez",               # 1961-1962     6             Ricardo Rodríguez
    "roberto-bussinello",              # 1961-1965     3             Roberto Bussinello
    "roberto-lippi",                   # 1961-1963     3             Roberto Lippi
    "roger-penske",                    # 1961-1962     2             Roger Penske
    "walt-hansgen",                    # 1961-1964     2             Walt Hansgen
    "ben-pon",                         # 1962          1             Ben Pon
    "bruce-johnstone",                 # 1962          1             Bruce Johnstone
    "doug-serrurier",                  # 1962-1965     3             Doug Serrurier
    "ernesto-prinoth",                 # 1962          1             Ernesto Prinoth
    "ernie-pieterse",                  # 1962-1965     3             Ernie Pieterse
    "gunther-seiffert",                # 1962          1             Günther Seiffert
    "heini-walter",                    # 1962          1             Heini Walter
    "heinz-schiller",                  # 1962          1             Heinz Schiller
    "jay-chamberlain",                 # 1962          3             Jay Chamberlain
    "john-campbell-jones",             # 1962-1963     2             John Campbell-Jones
    "mike-harris",                     # 1962          1             Mike Harris
    "neville-lederle",                 # 1962-1965     2             Neville Lederle
    "rob-schroeder",                   # 1962          1             Rob Schroeder
    "timmy-mayer",                     # 1962          1             Timmy Mayer
    "tony-settember",                  # 1962-1963     7             Tony Settember
    "tony-shelly",                     # 1962          3             Tony Shelly
    "brausch-niemann",                 # 1963-1965     2             Brausch Niemann
    "david-prophet",                   # 1963-1965     2             David Prophet
    "ernesto-brambilla",               # 1963-1969     2             Ernesto Brambilla
    "frank-dochnal",                   # 1963          1             Frank Dochnal
    "gerhard-mitter",                  # 1963-1969     7             Gerhard Mitter
    "ian-raby",                        # 1963-1965     7             Ian Raby
    "kurt-kuhnke",                     # 1963          1             Kurt Kuhnke
    "moises-solana",                   # 1963-1968     8             Moisés Solana
    "paddy-driver",                    # 1963-1974     2             Paddy Driver
    "peter-broeker",                   # 1963          1             Peter Broeker
    "peter-de-klerk",                  # 1963-1970     4             Peter de Klerk
    "sam-tingle",                      # 1963-1969     5             Sam Tingle
    "trevor-blokdyk",                  # 1963-1965     2             Trevor Blokdyk
    "frank-gardner",                   # 1964-1968     9             Frank Gardner
    "giacomo-russo",                   # 1964-1966     3             Giacomo Russo
    "jean-claude-rudaz",               # 1964          1             Jean-Claude Rudaz
    "john-taylor",                     # 1964-1966     5             John Taylor
    "ronnie-bucknum",                  # 1964-1966    11             Ronnie Bucknum
    "alan-rollinson",                  # 1965          1             Alan Rollinson
    "bob-bondurant",                   # 1965-1966     9             Bob Bondurant
    "brian-gubby",                     # 1965          1             Brian Gubby
    "clive-puzey",                     # 1965          1             Clive Puzey
    "dave-charlton",                   # 1965-1975    14             Dave Charlton
    "giorgio-bassi",                   # 1965          1             Giorgio Bassi
    "jackie-pretorius",                # 1965-1973     4             Jackie Pretorius
    "john-rhodes",                     # 1965          1             John Rhodes
    "paul-hawkins",                    # 1965          3             Paul Hawkins
    "alan-rees",                       # 1966-1967     3             Alan Rees
    "chris-irwin",                     # 1966-1967    10             Chris Irwin
    "chris-lawrence",                  # 1966          2             Chris Lawrence
    "guy-ligier",                      # 1966-1967    13             Guy Ligier
    "hubert-hahne",                    # 1966-1970     5             Hubert Hahne
    "jo-schlesser",                    # 1966-1968     3             Jo Schlesser
    "kurt-ahrens-jr",                  # 1966-1969     4             Kurt Ahrens, Jr.
    "silvio-moser",                    # 1966-1971    20             Silvio Moser
    "al-pease",                        # 1967-1969     3             Al Pease
    "brian-hart",                      # 1967          1             Brian Hart
    "david-hobbs",                     # 1967-1974     7             David Hobbs
    "eppie-wietzes",                   # 1967-1974     2             Eppie Wietzes
    "jonathan-williams",               # 1967          1             Jonathan Williams
    "luki-botha",                      # 1967          1             Luki Botha
    "mike-fisher",                     # 1967          2             Mike Fisher
    "tom-jones",                       # 1967          1             Tom Jones
    "andrea-de-adamich",               # 1968-1973    36             Andrea de Adamich
    "basil-van-rooyen",                # 1968-1969     2             Basil van Rooyen
    "bill-brack",                      # 1968-1972     3             Bill Brack
    "bobby-unser",                     # 1968          2             Bobby Unser
    "derek-bell",                      # 1968-1974    16             Derek Bell
    "robin-widdows",                   # 1968          1             Robin Widdows
    "vic-elford",                      # 1968-1971    13             Vic Elford
    "dieter-quester",                  # 1969-1974     2             Dieter Quester
    "george-eaton",                    # 1969-1971    13             George Eaton
    "john-cordts",                     # 1969          1             John Cordts
    "john-miles",                      # 1969-1970    15             John Miles
    "peter-westbury",                  # 1969-1970     2             Peter Westbury
    "xavier-perrot",                   # 1969          1             Xavier Perrot
    "alex-soler-roig",                 # 1970-1972    10             Alex Soler-Roig
    "gus-hutchison",                   # 1970          1             Gus Hutchison
    "ignazio-giunti",                  # 1970          4             Ignazio Giunti
    "nanni-galli",                     # 1970-1973    20             Nanni Galli
    "chris-craft",                     # 1971          2             Chris Craft
    "david-walker",                    # 1971-1972    11             David Walker
    "francois-mazet",                  # 1971          1             François Mazet
    "gijs-van-lennep",                 # 1971-1975    10             Gijs van Lennep
    "helmut-marko",                    # 1971-1972    10             Helmut Marko
    "howden-ganley",                   # 1971-1974    41             Howden Ganley
    "john-cannon",                     # 1971          1             John Cannon
    "max-jean",                        # 1971          1             Max Jean
    "mike-beuttler",                   # 1971-1973    29             Mike Beuttler
    "sam-posey",                       # 1971-1972     2             Sam Posey
    "skip-barber",                     # 1971-1972     6             Skip Barber
    "arturo-merzario",                 # 1972-1979    85             Arturo Merzario
    "francois-migault",                # 1972-1975    16             François Migault
    "vern-schuppan",                   # 1972-1977    13             Vern Schuppan
    "william-ferguson",                # 1972          1             William Ferguson
    "wilson-fittipaldi",               # 1972-1975    38             Wilson Fittipaldi
    "david-purley",                    # 1973-1977    11             David Purley
    "eddie-keizan",                    # 1973-1975     3             Eddie Keizan
    "graham-mcrae",                    # 1973          1             Graham McRae
    "luiz-bueno",                      # 1973          1             Luiz Bueno
    "rikky-von-opel",                  # 1973-1974    14             Rikky von Opel
    "roger-williamson",                # 1973          2             Roger Williamson
    "tom-belso",                       # 1973-1974     5             Tom Belsø
    "bertil-roos",                     # 1974          1             Bertil Roos
    "carlo-facetti",                   # 1974          1             Carlo Facetti
    "gerard-larrousse",                # 1974          2             Gérard Larrousse
    "guy-edwards",                     # 1974-1977    17             Guy Edwards
    "helmuth-koinigg",                 # 1974          3             Helmuth Koinigg
    "ian-ashley",                      # 1974-1977    11             Ian Ashley
    "ian-scheckter",                   # 1974-1977    20             Ian Scheckter
    "john-nicholson",                  # 1974-1975     2             John Nicholson
    "jose-dolhem",                     # 1974          3             José Dolhem
    "larry-perkins",                   # 1974-1977    15             Larry Perkins
    "leo-kinnunen",                    # 1974          6             Leo Kinnunen
    "mike-wilds",                      # 1974-1976     8             Mike Wilds
    "richard-robarts",                 # 1974          4             Richard Robarts
    "teddy-pilette",                   # 1974-1977     4             Teddy Pilette
    "bob-evans",                       # 1975-1976    12             Bob Evans
    "brett-lunger",                    # 1975-1978    43             Brett Lunger
    "damien-magee",                    # 1975-1976     2             Damien Magee
    "dave-morgan",                     # 1975          1             Dave Morgan
    "guy-tunmer",                      # 1975          1             Guy Tunmer
    "harald-ertl",                     # 1975-1980    28             Harald Ertl
    "hiroshi-fushida",                 # 1975          2             Hiroshi Fushida
    "jim-crawford",                    # 1975          2             Jim Crawford
    "jo-vonlanthen",                   # 1975          1             Jo Vonlanthen
    "michel-leclere",                  # 1975-1976     8             Michel Leclère
    "renzo-zorzi",                     # 1975-1977     7             Renzo Zorzi
    "roelof-wunderink",                # 1975          6             Roelof Wunderink
    "tony-brise",                      # 1975         10             Tony Brise
    "tony-trimmer",                    # 1975-1978     6             Tony Trimmer
    "torsten-palm",                    # 1975          2             Torsten Palm
    "alessandro-pesenti-rossi",        # 1976          4             Alessandro Pesenti-Rossi
    "alex-ribeiro",                    # 1976-1979    20             Alex Ribeiro
    "boy-hayje",                       # 1976-1977     7             Boy Hayje
    "conny-andersson",                 # 1976-1977     5             Conny Andersson
    "divina-galica",                   # 1976-1978     3             Divina Galica
    "emilio-de-villota",               # 1976-1982    14             Emilio de Villota
    "emilio-zapico",                   # 1976          1             Emilio Zapico
    "hans-binder",                     # 1976-1978    15             Hans Binder
    "ingo-hoffmann",                   # 1976-1977     6             Ingo Hoffmann
    "jac-nellemann",                   # 1976          1             Jac Nellemann
    "kazuyoshi-hoshino",               # 1976-1977     2             Kazuyoshi Hoshino
    "loris-kessel",                    # 1976-1977     6             Loris Kessel
    "masahiro-hasemi",                 # 1976          1             Masahiro Hasemi
    "masami-kuwashima",                # 1976          1             Masami Kuwashima
    "noritake-takahara",               # 1976-1977     2             Noritake Takahara
    "otto-stuppacher",                 # 1976          3             Otto Stuppacher
    "patrick-neve",                    # 1976-1978    14             Patrick Nève
    "warwick-brown",                   # 1976          1             Warwick Brown
    "andy-sutcliffe",                  # 1977          1             Andy Sutcliffe
    "bernard-de-dryver",               # 1977-1978     2             Bernard de Dryver
    "brian-mcguire",                   # 1977          1             Brian McGuire
    "danny-ongais",                    # 1977-1978     6             Danny Ongais
    "giorgio-francia",                 # 1977-1981     2             Giorgio Francia
    "hans-heyer",                      # 1977          1             Hans Heyer
    "hector-rebaque",                  # 1977-1981    58             Héctor Rebaque
    "kunimitsu-takahashi",             # 1977          1             Kunimitsu Takahashi
    "lamberto-leoni",                  # 1977-1978     5             Lamberto Leoni
    "michael-bleekemolen",             # 1977-1978     5             Michael Bleekemolen
    "mikko-kozarowitzky",              # 1977          2             Mikko Kozarowitzky
    "rupert-keegan",                   # 1977-1982    37             Rupert Keegan
    "alberto-colombo",                 # 1978          3             Alberto Colombo
    "beppe-gabbiani",                  # 1978-1981    17             Beppe Gabbiani
    "bobby-rahal",                     # 1978          2             Bobby Rahal
    "carlo-franchi",                   # 1978          1             Carlo Franchi
    "derek-daly",                      # 1978-1982    64             Derek Daly
    "geoff-lees",                      # 1978-1982    12             Geoff Lees
    "gianfranco-brancatelli",          # 1979          3             Gianfranco Brancatelli
    "jan-lammers",                     # 1979-1992    41             Jan Lammers
    "patrick-gaillard",                # 1979          5             Patrick Gaillard
    "ricardo-zunino",                  # 1979-1981    11             Ricardo Zunino
    "david-kennedy",                   # 1980          7             David Kennedy
    "desire-wilson",                   # 1980          1             Desiré Wilson
    "kevin-cogan",                     # 1980-1981     2             Kevin Cogan
    "manfred-winkelhock",              # 1980-1985    56             Manfred Winkelhock
    "mike-thackwell",                  # 1980-1984     5             Mike Thackwell
    "stephen-south",                   # 1980          1             Stephen South
    "tiff-needell",                    # 1980          2             Tiff Needell
    "chico-serra",                     # 1981-1983    33             Chico Serra
    "eliseo-salazar",                  # 1981-1983    37             Eliseo Salazar
    "jacques-villeneuve-sr",           # 1981-1983     3             Jacques Villeneuve, Sr.
    "miguel-angel-guerra",             # 1981          4             Miguel Ángel Guerra
    "piercarlo-ghinzani",              # 1981-1989   111             Piercarlo Ghinzani
    "ricardo-londono",                 # 1981          1             Ricardo Londoño
    "siegfried-stohr",                 # 1981         13             Siegfried Stohr
    "slim-borgudd",                    # 1981-1982    15             Slim Borgudd
    "mauro-baldi",                     # 1982-1985    41             Mauro Baldi
    "raul-boesel",                     # 1982-1983    30             Raul Boesel
    "riccardo-paletti",                # 1982          8             Riccardo Paletti
    "roberto-guerrero",                # 1982-1983    28             Roberto Guerrero
    "tommy-byrne",                     # 1982          5             Tommy Byrne
    "corrado-fabi",                    # 1983-1984    18             Corrado Fabi
    "danny-sullivan",                  # 1983         15             Danny Sullivan
    "jean-louis-schlesser",            # 1983-1988     2             Jean-Louis Schlesser
    "johnny-cecotto",                  # 1983-1984    23             Johnny Cecotto
    "kenny-acheson",                   # 1983-1985    10             Kenny Acheson
    "francois-hesnault",               # 1984-1985    21             François Hesnault
    "huub-rothengatter",               # 1984-1986    30             Huub Rothengatter
    "jo-gartner",                      # 1984          8             Jo Gartner
    "philippe-alliot",                 # 1984-1994   116             Philippe Alliot
    "pierluigi-martini",               # 1984-1995   124             Pierluigi Martini
    "stefan-bellof",                   # 1984-1985    22             Stefan Bellof
    "christian-danner",                # 1985-1989    47             Christian Danner
    "alex-caffi",                      # 1986-1992    77             Alex Caffi
    "allen-berg",                      # 1986          9             Allen Berg
    "johnny-dumfries",                 # 1986         16             Johnny Dumfries
    "adrian-campos",                   # 1987-1988    21             Adrián Campos
    "franco-forini",                   # 1987          3             Franco Forini
    "gabriele-tarquini",               # 1987-1995    78             Gabriele Tarquini
    "pascal-fabre",                    # 1987         14             Pascal Fabre
    "yannick-dalmas",                  # 1987-1994    50             Yannick Dalmas
    "bernd-schneider",                 # 1988-1990    34             Bernd Schneider
    "julian-bailey",                   # 1988-1991    20             Julian Bailey
    "luis-perez-sala",                 # 1988-1989    32             Luis Pérez-Sala
    "oscar-larrauri",                  # 1988-1989    21             Oscar Larrauri
    "pierre-henri-raphanel",           # 1988-1989    17             Pierre-Henri Raphanel
    "emanuele-pirro",                  # 1989-1991    40             Emanuele Pirro
    "enrico-bertaggia",                # 1989-1992     8             Enrico Bertaggia
    "gregor-foitek",                   # 1989-1990    22             Gregor Foitek
    "joachim-winkelhock",              # 1989          7             Joachim Winkelhock
    "martin-donnelly",                 # 1989-1990    15             Martin Donnelly
    "olivier-grouillard",              # 1989-1992    62             Olivier Grouillard
    "paolo-barilla",                   # 1989-1990    15             Paolo Barilla
    "volker-weidler",                  # 1989         10             Volker Weidler
    "claudio-langes",                  # 1990         14             Claudio Langes
    "david-brabham",                   # 1990-1994    30             David Brabham
    "gary-brabham",                    # 1990          2             Gary Brabham
    "alex-zanardi",                    # 1991-1999    44             Alex Zanardi
    "eric-van-de-poele",               # 1991-1992    29             Eric van de Poele
    "erik-comas",                      # 1991-1994    63             Érik Comas
    "fabrizio-barbazza",               # 1991-1993    20             Fabrizio Barbazza
    "karl-wendlinger",                 # 1991-1995    42             Karl Wendlinger
    "michael-bartels",                 # 1991          4             Michael Bartels
    "naoki-hattori",                   # 1991          2             Naoki Hattori
    "pedro-chaves",                    # 1991         13             Pedro Chaves
    "andrea-chiesa",                   # 1992         10             Andrea Chiesa
    "christian-fittipaldi",            # 1992-1994    43             Christian Fittipaldi
    "emanuele-naspetti",               # 1992-1993     6             Emanuele Naspetti
    "giovanna-amati",                  # 1992          3             Giovanna Amati
    "paul-belmondo",                   # 1992-1994    27             Paul Belmondo
    "perry-mccarthy",                  # 1992          7             Perry McCarthy
    "ukyo-katayama",                   # 1992-1997    97             Ukyo Katayama
    "jean-marc-gounon",                # 1993-1994     9             Jean-Marc Gounon
    "luca-badoer",                     # 1993-2009    58             Luca Badoer
    "marco-apicella",                  # 1993          1             Marco Apicella
    "michael-andretti",                # 1993         13             Michael Andretti
    "pedro-lamy",                      # 1993-1996    32             Pedro Lamy
    "toshio-suzuki",                   # 1993          2             Toshio Suzuki
    "andrea-montermini",               # 1994-1996    28             Andrea Montermini
    "domenico-schiattarella",          # 1994-1995     7             Domenico Schiattarella
    "franck-lagorce",                  # 1994          2             Franck Lagorce
    "hideki-noda",                     # 1994          3             Hideki Noda
    "jean-denis-deletraz",             # 1994-1995     3             Jean-Denis Délétraz
    "jos-verstappen",                  # 1994-2003   107             Jos Verstappen
    "olivier-beretta",                 # 1994         10             Olivier Beretta
    "philippe-adams",                  # 1994          2             Philippe Adams
    "roland-ratzenberger",             # 1994          3             Roland Ratzenberger
    "taki-inoue",                      # 1994-1995    18             Taki Inoue
    "giovanni-lavaggi",                # 1995-1996    10             Giovanni Lavaggi
    "jan-magnussen",                   # 1995-1998    25             Jan Magnussen
    "jean-christophe-boullion",        # 1995         11             Jean-Christophe Boullion
    "max-papis",                       # 1995          7             Max Papis
    "pedro-diniz",                     # 1995-2000    99             Pedro Diniz
    "ricardo-rosset",                  # 1996-1998    33             Ricardo Rosset
    "tarso-marques",                   # 1996-2001    26             Tarso Marques
    "norberto-fontana",                # 1997          4             Norberto Fontana
    "shinji-nakano",                   # 1997-1998    33             Shinji Nakano
    "vincenzo-sospiri",                # 1997          1             Vincenzo Sospiri
    "esteban-tuero",                   # 1998         16             Esteban Tuero
    "toranosuke-takagi",               # 1998-1999    32             Toranosuke Takagi
    "marc-gene",                       # 1999-2004    36             Marc Gené
    "ricardo-zonta",                   # 1999-2005    38             Ricardo Zonta
    "stephane-sarrazin",               # 1999          1             Stéphane Sarrazin
    "gaston-mazzacane",                # 2000-2001    21             Gastón Mazzacane
    "luciano-burti",                   # 2000-2001    15             Luciano Burti
    "alex-yoong",                      # 2001-2002    18             Alex Yoong
    "enrique-bernoldi",                # 2001-2002    29             Enrique Bernoldi
    "tomas-enge",                      # 2001          3             Tomáš Enge
    "allan-mcnish",                    # 2002         17             Allan McNish
    "anthony-davidson",                # 2002-2008    24             Anthony Davidson
    "antonio-pizzonia",                # 2003-2005    20             Antônio Pizzonia
    "cristiano-da-matta",              # 2003-2004    28             Cristiano da Matta
    "justin-wilson",                   # 2003         16             Justin Wilson
    "nicolas-kiesa",                   # 2003          5             Nicolas Kiesa
    "ralph-firman",                    # 2003         15             Ralph Firman
    "zsolt-baumgartner",               # 2003-2004    20             Zsolt Baumgartner
    "christian-klien",                 # 2004-2010    51             Christian Klien
    "gianmaria-bruni",                 # 2004         18             Gianmaria Bruni
    "giorgio-pantano",                 # 2004         14             Giorgio Pantano
    "christijan-albers",               # 2005-2007    46             Christijan Albers
    "narain-karthikeyan",              # 2005-2012    48             Narain Karthikeyan
    "patrick-friesacher",              # 2005         11             Patrick Friesacher
    "robert-doornbos",                 # 2005-2006    11             Robert Doornbos
    "vitantonio-liuzzi",               # 2005-2011    81             Vitantonio Liuzzi
    "franck-montagny",                 # 2006          7             Franck Montagny
    "sakon-yamamoto",                  # 2006-2010    21             Sakon Yamamoto
    "scott-speed",                     # 2006-2007    28             Scott Speed
    "yuji-ide",                        # 2006          4             Yuji Ide
    "kazuki-nakajima",                 # 2007-2009    36             Kazuki Nakajima
    "markus-winkelhock",               # 2007          1             Markus Winkelhock
    "sebastien-bourdais",              # 2008-2009    27             Sébastien Bourdais
    "jaime-alguersuari",               # 2009-2011    46             Jaime Alguersuari
    "sebastien-buemi",                 # 2009-2011    55             Sébastien Buemi
    "karun-chandhok",                  # 2010-2011    11             Karun Chandhok
    "lucas-di-grassi",                 # 2010         19             Lucas di Grassi
    "jerome-dambrosio",                # 2011-2012    20             Jérôme d'Ambrosio
    "paul-di-resta",                   # 2011-2017    59             Paul di Resta
    "charles-pic",                     # 2012-2013    39             Charles Pic
    "jean-eric-vergne",                # 2012-2014    58             Jean-Éric Vergne
    "giedo-van-der-garde",             # 2013         19             Giedo van der Garde
    "max-chilton",                     # 2013-2014    35             Max Chilton
    "alexander-rossi",                 # 2014-2015     7             Alexander Rossi
    "andre-lotterer",                  # 2014          1             André Lotterer
    "marcus-ericsson",                 # 2014-2018    97             Marcus Ericsson
    "will-stevens",                    # 2014-2015    20             Will Stevens
    "felipe-nasr",                     # 2015-2016    40             Felipe Nasr
    "roberto-merhi",                   # 2015         14             Roberto Merhi
    "jolyon-palmer",                   # 2016-2017    37             Jolyon Palmer
    "pascal-wehrlein",                 # 2016-2017    40             Pascal Wehrlein
    "rio-haryanto",                    # 2016         12             Rio Haryanto
    "stoffel-vandoorne",               # 2016-2018    42             Stoffel Vandoorne
    "antonio-giovinazzi",              # 2017-2021    62             Antonio Giovinazzi
    "brendon-hartley",                 # 2017-2018    25             Brendon Hartley
    "sergey-sirotkin",                 # 2018         21             Sergey Sirotkin
    "jack-aitken",                     # 2020          1             Jack Aitken
    "nicholas-latifi",                 # 2020-2022    61             Nicholas Latifi
    "pietro-fittipaldi",               # 2020          2             Pietro Fittipaldi
    "mick-schumacher",                 # 2021-2022    44             Mick Schumacher
    "nikita-mazepin",                  # 2021         22             Nikita Mazepin
    "nyck-de-vries",                   # 2022-2023    11             Nyck de Vries
    "logan-sargeant",                  # 2023-2024    37             Logan Sargeant
]
