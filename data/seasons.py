# -*- coding: utf-8 -*-
"""
Every FIA Formula One World Championship season, 1950-2026.

Columns:
 year, rounds, champion, champion_team, champ_pts, champ_wins,
 runner_up, runner_up_pts, constructors_champion, constructors_pts,
 engine_formula, tyres, notes, confidence

Points shown are the NET championship points (after any dropped-score
rule was applied), which is the figure the FIA classifies on. Where the
gross total differed materially it is called out in `notes`.
"""

F_15S45 = "1.5 L supercharged or 4.5 L naturally aspirated"
F_F2 = "Formula 2: 2.0 L naturally aspirated (F1 entries permitted but non-scoring in practice)"
F_25 = "2.5 L naturally aspirated"
F_15 = "1.5 L naturally aspirated"
F_30 = "3.0 L naturally aspirated / 1.5 L forced induction"
F_30T = "3.0 L naturally aspirated / 1.5 L turbocharged"
F_15T = "1.5 L turbocharged only (in practice)"
F_35 = "3.5 L naturally aspirated"
F_35T = "3.5 L naturally aspirated or 1.5 L turbocharged (boost limited)"
F_30V10 = "3.0 L naturally aspirated, max 10 cylinders (V10 from 2000 mandated)"
F_24V8 = "2.4 L naturally aspirated V8"
F_16H = "1.6 L V6 turbo hybrid (ERS: MGU-K + MGU-H)"
F_16H26 = "1.6 L V6 turbo hybrid, no MGU-H, ~50/50 ICE/electric split, 100% sustainable fuel"

T_EARLY = "Pirelli, Englebert, Dunlop, Firestone"
T_60S = "Dunlop, Firestone, Goodyear"
T_70S = "Goodyear, Firestone, Dunlop"
T_WAR = "Goodyear, Michelin"
T_GY = "Goodyear (sole supplier)"
T_GY_PIR = "Goodyear, Pirelli"
T_BS_GY = "Bridgestone, Goodyear"
T_BS_MI = "Bridgestone, Michelin"
T_BS = "Bridgestone (sole supplier)"
T_PIR = "Pirelli (sole supplier)"

SEASONS = [
    # ---------------------------------------------------------- 1950s
    (1950, 7, "farina", "alfa-romeo", 30, 3, "fangio", 27, None, None, F_15S45, T_EARLY,
     "Inaugural World Championship. Indianapolis 500 counted towards the title (1950-60) though almost no F1 regulars entered. No Constructors' Championship yet. Best 4 of 7 results counted.", "high"),
    (1951, 8, "fangio", "alfa-romeo", 31, 3, "ascari", 25, None, None, F_15S45, T_EARLY,
     "Fangio's first title. Alfa Romeo withdrew at season's end when the FIA declined to fund its programme; gross total 37, net 31 after dropped scores.", "high"),
    (1952, 8, "ascari", "ferrari", 36, 6, "farina", 24, None, None, F_F2,
     T_EARLY, "Run to Formula 2 regulations after Alfa's withdrawal left too few F1 cars. Ascari won every race he entered.", "high"),
    (1953, 9, "ascari", "ferrari", 34.5, 5, "fangio", 28, None, None, F_F2, T_EARLY,
     "Second consecutive title; Ascari remains the only Italian double champion.", "high"),
    (1954, 9, "fangio", "mercedes", 42, 6, "gonzalez", 25.14, None, None, F_25, T_EARLY,
     "Fangio started the year at Maserati and switched to the new Mercedes W196 from the French GP. Mercedes returned to Grand Prix racing after an 15-year absence.", "high"),
    (1955, 7, "fangio", "mercedes", 40, 4, "moss", 23, None, None, F_25, T_EARLY,
     "Season truncated after the Le Mans disaster; the French, German, Swiss and Spanish rounds were cancelled. Switzerland has never held a championship race since.", "high"),
    (1956, 8, "fangio", "ferrari", 30, 3, "moss", 27, None, None, F_25, T_EARLY,
     "Fangio drove the Lancia-Ferrari D50. Peter Collins handed his car to Fangio at Monza, surrendering his own title chance.", "high"),
    (1957, 8, "fangio", "maserati", 40, 4, "moss", 25, None, None, F_25, T_EARLY,
     "Fangio's fifth and final title, aged 46 — a record that stood until 2003. His Nurburgring drive is widely held to be the greatest of the era.", "high"),
    (1958, 11, "hawthorn", "ferrari", 42, 1, "moss", 41, "vanwall", 48, F_25, T_EARLY,
     "First Constructors' Championship, won by Vanwall. Hawthorn took the drivers' title with one win to Moss's four, partly because Moss testified in Hawthorn's defence at Porto. Britain's first champion.", "high"),
    (1959, 9, "brabham", "cooper", 31, 2, "brooks", 27, "cooper", 40, F_25, T_60S,
     "The rear-engined revolution: Cooper's mid-engined T51 broke the front-engined orthodoxy for good.", "high"),

    # ---------------------------------------------------------- 1960s
    (1960, 10, "brabham", "cooper", 43, 5, "mclaren-d", 34, "cooper", 48, F_25, T_60S,
     "Last year the Indianapolis 500 counted. Five straight wins for Brabham mid-season.", "high"),
    (1961, 8, "p-hill", "ferrari", 34, 2, "von-trips", 33, "ferrari", 45, F_15, T_60S,
     "Title decided at Monza where Wolfgang von Trips was killed along with 15 spectators. Phil Hill became the first American champion.", "high"),
    (1962, 9, "g-hill", "brm", 42, 4, "clark", 30, "brm", 42, F_15, T_60S,
     "BRM's only championship, and Graham Hill's first.", "high"),
    (1963, 10, "clark", "lotus", 54, 7, "ginther", 29, "lotus", 54, F_15, T_60S,
     "Clark's seven wins from ten starts in the Lotus 25 monocoque — the first fully stressed-skin F1 chassis.", "high"),
    (1964, 10, "surtees", "ferrari", 40, 2, "g-hill", 39, "ferrari", 45, F_15, T_60S,
     "John Surtees remains the only person to win world championships on both two wheels and four.", "high"),
    (1965, 10, "clark", "lotus", 54, 6, "g-hill", 40, "lotus", 54, F_15, T_60S,
     "Clark won the Indianapolis 500 and the F1 title in the same year, skipping Monaco to do so.", "high"),
    (1966, 9, "brabham", "brabham", 42, 4, "surtees", 28, "brabham", 42, F_30, T_60S,
     "The 3.0 L formula begins — 'the return of power'. Brabham is still the only man to win the title in a car bearing his own name.", "high"),
    (1967, 11, "hulme", "brabham", 51, 2, "brabham", 46, "brabham", 63, F_30, T_60S,
     "Denny Hulme beat his own team owner. The Cosworth DFV debuted at Zandvoort in the Lotus 49 and won first time out.", "high"),
    (1968, 12, "g-hill", "lotus", 48, 3, "stewart", 36, "lotus", 62, F_30, T_60S,
     "Jim Clark killed at Hockenheim in F2, April 1968. Graham Hill held Lotus together to take the title. Sponsorship liveries appeared (Gold Leaf Team Lotus) and wings arrived at Spa.", "high"),
    (1969, 11, "stewart", "matra", 63, 6, "ickx", 37, "matra", 66, F_30, T_60S,
     "Matra's only title, run by Ken Tyrrell. High-mounted aerofoils banned mid-season after failures at Barcelona.", "high"),

    # ---------------------------------------------------------- 1970s
    (1970, 13, "rindt", "lotus", 45, 5, "ickx", 40, "lotus", 59, F_30, T_70S,
     "Jochen Rindt killed in practice at Monza and became the sport's only posthumous World Champion. Lotus 72 introduced side radiators and torsion-bar suspension.", "high"),
    (1971, 11, "stewart", "tyrrell", 62, 6, "peterson", 33, "tyrrell", 73, F_30, T_70S,
     "Tyrrell's first championship as a constructor in its own right.", "high"),
    (1972, 12, "fittipaldi", "lotus", 61, 5, "stewart", 45, "lotus", 61, F_30, T_70S,
     "At 25, Emerson Fittipaldi became the youngest champion to that point — a record held for 33 years.", "high"),
    (1973, 15, "stewart", "tyrrell", 71, 5, "fittipaldi", 55, "lotus", 92, F_30, T_70S,
     "Stewart's third title; he retired immediately after the death of team-mate Francois Cevert at Watkins Glen, skipping what would have been his 100th GP.", "high"),
    (1974, 15, "fittipaldi", "mclaren", 55, 3, "regazzoni", 52, "mclaren", 73, F_30, T_70S,
     "McLaren's first championship double, four years after Bruce McLaren's death testing at Goodwood.", "high"),
    (1975, 14, "lauda", "ferrari", 64.5, 5, "fittipaldi", 45, "ferrari", 72.5, F_30, T_70S,
     "Ferrari's first title in eleven years, built on the transverse-gearbox 312T.", "high"),
    (1976, 16, "hunt", "mclaren", 69, 6, "lauda", 68, "ferrari", 83, F_30, T_70S,
     "Decided by one point in the rain at Fuji after Lauda's near-fatal Nurburgring crash and his decision to withdraw from the finale. The Nordschleife never held a championship race again.", "high"),
    (1977, 17, "lauda", "ferrari", 72, 3, "scheckter", 55, "ferrari", 95, F_30T, T_70S,
     "Renault introduced the turbocharged RS01 at Silverstone — mocked as the 'yellow teapot', it changed the sport.", "high"),
    (1978, 16, "andretti", "lotus", 64, 6, "peterson", 51, "lotus", 86, F_30T, T_70S,
     "Ground effect arrives: the Lotus 79 'wing car'. Ronnie Peterson died from injuries sustained at Monza.", "high"),
    (1979, 15, "scheckter", "ferrari", 51, 3, "villeneuve-g", 47, "ferrari", 113, F_30T, T_70S,
     "Ferrari's last drivers' title until 2000. Gilles Villeneuve held station behind Scheckter at Monza rather than take the fight to his team-mate.", "high"),

    # ---------------------------------------------------------- 1980s
    (1980, 14, "jones", "williams", 67, 5, "piquet", 54, "williams", 120, F_30T, T_70S,
     "Williams's first championship, eleven years after Frank Williams's first entry.", "high"),
    (1981, 15, "piquet", "brabham", 50, 3, "reutemann", 49, "williams", 95, F_30T, T_WAR,
     "Sliding skirts banned; Brabham's hydropneumatic ride-height system exploited the letter of the rule. Concorde Agreement signed, ending the FISA-FOCA war.", "high"),
    (1982, 16, "k-rosberg", "williams", 44, 1, "pironi", 39, "ferrari", 74, F_30T, T_WAR,
     "The sport's darkest modern season: Gilles Villeneuve killed at Zolder, Riccardo Paletti at Montreal, Didier Pironi career-ended at Hockenheim. Keke Rosberg took the title with a single win.", "high"),
    (1983, 15, "piquet", "brabham", 59, 3, "prost", 57, "ferrari", 89, F_30T, T_WAR,
     "First turbo-powered drivers' champion. Flat bottoms mandated, killing ground effect.", "high"),
    (1984, 16, "lauda", "mclaren", 72, 5, "prost", 71.5, "mclaren", 143.5, F_30T, T_GY_PIR,
     "The closest margin in history: half a point. McLaren MP4/2 with TAG-Porsche power won 12 of 16.", "high"),
    (1985, 16, "prost", "mclaren", 73, 5, "alboreto", 53, "mclaren", 90, F_30T, T_GY_PIR,
     "France's first World Champion.", "high"),
    (1986, 16, "prost", "mclaren", 72, 4, "mansell", 70, "williams", 141, F_30T, T_GY_PIR,
     "Mansell's tyre exploded at Adelaide with the title in his hands; Prost became the first back-to-back champion since Brabham in 1960.", "high"),
    (1987, 16, "piquet", "williams", 73, 3, "mansell", 61, "williams", 137, F_35T, T_GY,
     "Naturally aspirated cars readmitted alongside boost-limited turbos. Piquet's third title.", "high"),
    (1988, 16, "senna", "mclaren", 90, 8, "prost", 87, "mclaren", 199, F_35T, T_GY,
     "McLaren MP4/4 won 15 of 16 races — the most dominant single season by win rate. Prost scored more gross points (105 to 94) but lost on dropped scores.", "high"),
    (1989, 16, "prost", "mclaren", 76, 4, "senna", 60, "mclaren", 141, F_35, T_GY,
     "Turbos banned. Title settled by the Suzuka chicane collision; Senna disqualified. Last year of dropped scores.", "high"),

    # ---------------------------------------------------------- 1990s
    (1990, 16, "senna", "mclaren", 78, 6, "prost", 71, "mclaren", 121, F_35, T_GY,
     "Suzuka again — Senna drove into Prost at Turn 1, settling the title on lap 1.", "high"),
    (1991, 16, "senna", "mclaren", 96, 7, "mansell", 72, "mclaren", 139, F_35, T_GY_PIR,
     "Senna's third and final title. Michael Schumacher debuted at Spa for Jordan.", "high"),
    (1992, 16, "mansell", "williams", 108, 9, "patrese", 56, "williams", 164, F_35, T_GY,
     "The Williams FW14B with active suspension, traction control and semi-automatic gearbox. Mansell's nine wins were a single-season record at the time.", "high"),
    (1993, 16, "prost", "williams", 99, 7, "senna", 73, "williams", 168, F_35, T_GY,
     "Prost's fourth title, then retirement. Driver aids banned for 1994.", "high"),
    (1994, 16, "schumacher", "benetton", 92, 8, "d-hill", 91, "williams", 118, F_35, T_GY,
     "Ayrton Senna and Roland Ratzenberger killed at Imola over one weekend; Karl Wendlinger critically injured at Monaco. The GPDA reformed and the FIA's modern safety programme began. Title decided by collision at Adelaide.", "high"),
    (1995, 17, "schumacher", "benetton", 102, 9, "d-hill", 69, "benetton", 137, F_30V10, T_GY,
     "Engine capacity cut to 3.0 L. Benetton's only constructors' title.", "high"),
    (1996, 16, "d-hill", "williams", 97, 8, "villeneuve-j", 78, "williams", 175, F_30V10, T_GY,
     "Damon Hill followed his father Graham — the only father-and-son World Champions until Keke and Nico Rosberg in 2016.", "high"),
    (1997, 17, "villeneuve-j", "williams", 81, 7, "frentzen", 42, "williams", 123, F_30V10, T_BS_GY,
     "Schumacher finished second on the road but was excluded from the final classification for driving into Villeneuve at Jerez. Bridgestone entered, ending Goodyear's monopoly.", "high"),
    (1998, 16, "hakkinen", "mclaren", 100, 8, "schumacher", 86, "mclaren", 156, F_30V10, T_BS_GY,
     "Narrow-track cars and grooved tyres introduced to cut cornering speed. McLaren MP4/13 with the Newey-designed 'brake steer' controversy.", "high"),
    (1999, 16, "hakkinen", "mclaren", 76, 5, "irvine", 74, "ferrari", 128, F_30V10, T_BS,
     "Ferrari's first constructors' title since 1983 while Schumacher sat out with a broken leg from Silverstone.", "high"),

    # ---------------------------------------------------------- 2000s
    (2000, 17, "schumacher", "ferrari", 108, 9, "hakkinen", 89, "ferrari", 170, F_30V10, T_BS,
     "Ferrari's first drivers' championship in 21 years.", "high"),
    (2001, 17, "schumacher", "ferrari", 123, 9, "coulthard", 65, "ferrari", 179, F_30V10, T_BS_MI,
     "Michelin returned. Traction control legalised again from the Spanish GP.", "high"),
    (2002, 17, "schumacher", "ferrari", 144, 11, "barrichello", 77, "ferrari", 221, F_30V10, T_BS_MI,
     "Schumacher finished on the podium in every race — still unmatched. Team orders at the A1-Ring caused such outcry they were banned for 2003.", "high"),
    (2003, 16, "schumacher", "ferrari", 93, 6, "raikkonen", 91, "ferrari", 158, F_30V10, T_BS_MI,
     "Points widened to the top eight to close the field up; the title went to the last round.", "high"),
    (2004, 18, "schumacher", "ferrari", 148, 13, "barrichello", 114, "ferrari", 262, F_30V10, T_BS_MI,
     "Thirteen wins in a season — a record until 2013. Schumacher's fifth straight and seventh overall.", "high"),
    (2005, 19, "alonso", "renault", 133, 7, "raikkonen", 112, "renault", 191, F_30V10, T_BS_MI,
     "Alonso became the youngest champion to that date at 24. Tyre changes were banned; the US GP at Indianapolis was run by six cars after Michelin's tyre failures.", "high"),
    (2006, 18, "alonso", "renault", 134, 7, "schumacher", 121, "renault", 206, F_30V10, T_BS_MI,
     "Schumacher's first retirement. Last year of V10 engines.", "high"),
    (2007, 17, "raikkonen", "ferrari", 110, 6, "hamilton", 109, "ferrari", 204, F_24V8, T_BS,
     "Raikkonen took the title by one point at the final round after McLaren's Hamilton and Alonso split the points. McLaren excluded from the constructors' championship over the 'Spygate' affair and fined $100m.", "high"),
    (2008, 18, "hamilton", "mclaren", 98, 5, "massa", 97, "ferrari", 172, F_24V8, T_BS,
     "Decided at the final corner of the final lap in Brazil. Hamilton became the youngest champion at the time and the sport's first Black World Champion.", "high"),
    (2009, 17, "button", "brawn", 95, 6, "vettel", 84, "brawn", 172, F_24V8, T_BS,
     "Brawn GP rose from the collapse of Honda's team and won both titles in its only season, aided by the double-diffuser interpretation. KERS introduced.", "high"),

    # ---------------------------------------------------------- 2010s
    (2010, 19, "vettel", "red-bull", 256, 5, "alonso", 252, "red-bull", 498, F_24V8, T_BS,
     "Four drivers could win at the finale in Abu Dhabi; Vettel led the championship for the first time only after the last race. Refuelling banned.", "high"),
    (2011, 19, "vettel", "red-bull", 392, 11, "button", 270, "red-bull", 650, F_24V8, T_PIR,
     "Pirelli became sole supplier; DRS and high-degradation tyres introduced to promote overtaking. Vettel took 15 poles.", "high"),
    (2012, 20, "vettel", "red-bull", 281, 5, "alonso", 278, "red-bull", 460, F_24V8, T_PIR,
     "Seven different winners in the first seven races. Vettel's third straight title by three points.", "high"),
    (2013, 19, "vettel", "red-bull", 397, 13, "alonso", 242, "red-bull", 596, F_24V8, T_PIR,
     "Nine consecutive wins to end the season — a record. Last year of the V8 era.", "high"),
    (2014, 19, "hamilton", "mercedes", 384, 11, "n-rosberg", 317, "mercedes", 701, F_16H, T_PIR,
     "The turbo-hybrid era begins. Mercedes won 16 of 19. Double points at the finale (used once, then dropped). Jules Bianchi critically injured at Suzuka.", "high"),
    (2015, 19, "hamilton", "mercedes", 381, 10, "n-rosberg", 322, "mercedes", 703, F_16H, T_PIR,
     "Hamilton's third title, equalling Senna.", "high"),
    (2016, 21, "n-rosberg", "mercedes", 385, 9, "hamilton", 380, "mercedes", 765, F_16H, T_PIR,
     "Nico Rosberg won the title and retired five days later. He and Keke are the second father-and-son champions.", "high"),
    (2017, 20, "hamilton", "mercedes", 363, 9, "vettel", 317, "mercedes", 668, F_16H, T_PIR,
     "Wider cars and tyres brought lap records tumbling. Halo approved for 2018.", "high"),
    (2018, 21, "hamilton", "mercedes", 408, 11, "vettel", 320, "mercedes", 655, F_16H, T_PIR,
     "Halo introduced. Hamilton's fifth title moved him past Fangio.", "high"),
    (2019, 21, "hamilton", "mercedes", 413, 11, "bottas", 326, "mercedes", 739, F_16H, T_PIR,
     "Mercedes's sixth consecutive double. Anthoine Hubert killed in the F2 race at Spa.", "high"),
    (2020, 17, "hamilton", "mercedes", 347, 11, "bottas", 223, "mercedes", 573, F_16H, T_PIR,
     "COVID-shortened calendar with new venues (Mugello, Portimao, Imola, Istanbul, Nurburgring). Hamilton equalled Schumacher's seven titles. Romain Grosjean survived a 67 g fireball at Bahrain.", "high"),
    (2021, 22, "verstappen", "red-bull", 395.5, 10, "hamilton", 387.5, "mercedes", 613.5, F_16H, T_PIR,
     "Settled on the final lap at Abu Dhabi after a contested safety-car restart; the FIA later found the race director had misapplied the rules and restructured race control. Sprint format trialled at three events.", "high"),
    (2022, 22, "verstappen", "red-bull", 454, 15, "leclerc", 308, "red-bull", 759, F_16H, T_PIR,
     "Ground effect returns under new aerodynamic regulations; porpoising dominated the early season. Fifteen wins set a new record.", "high"),
    (2023, 22, "verstappen", "red-bull", 575, 19, "perez", 285, "red-bull", 860, F_16H, T_PIR,
     "The most dominant season on record: 19 wins from 22, Red Bull winning 21 of 22 and scoring 860 points.", "high"),
    (2024, 24, "verstappen", "red-bull", 437, 9, "norris", 374, "mclaren", 666, F_16H, T_PIR,
     "Verstappen's fourth straight title while McLaren took its first constructors' crown since 1998. Longest calendar to that point at 24 rounds.", "high"),
    (2025, 24, "norris", "mclaren", 423, 7, "verstappen", 421, "mclaren", 833, F_16H, T_PIR,
     "Norris beat Verstappen by two points with team-mate Piastri third on 410 — the closest top-three in the sport's history. McLaren's 833 points set a constructors' record. Last season of the 2014-25 power-unit formula.", "verified"),
    (2026, 23, None, None, None, None, None, None, None, None, F_16H26, T_PIR,
     "Season in progress. New chassis and power-unit regulations; Audi and Cadillac join as the 11th and 12th entries. Active aerodynamics replace DRS.", "verified"),
]

# Championship-defining moments worth their own record
SEASON_NOTES_SOURCE = "https://www.formula1.com/en/results"
