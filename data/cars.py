# -*- coding: utf-8 -*-
"""
The cars.

A car here is a chassis design, not a season: the Lotus 79 raced in 1978 and
1979 and is one row. Where a design was revised and given a new designation
in period - 312T, 312T2, 312T3 - each is its own row, chained through
`supersedes`, because that is how the results were published.

Spec fields are None where no figure has been established. That is deliberate
and is not the same as zero. `spec_confidence` says how good the figures that
ARE present are: 'high' means they came off the car's own reference page,
'medium' means they are widely reported but not checked against a primary
source.

Tuple order:
  id, constructor_id, designation, full_name, from_year, to_year, supersedes,
  designers, engine_id, engine_name, tyres,
  engine_config, capacity_cc, aspiration, power_bhp, power_note, rev_limit,
  chassis_type, gearbox, suspension, brakes,
  weight_kg, wheelbase_mm, track_front_mm, track_rear_mm, fuel_l,
  concept, innovations, story, outcome,
  drivers_titles, constructors_titles, landmark, confidence, spec_confidence,
  source

Championship counts here are the titles the car was the team's primary chassis
for. They are authored rather than derived because a title season is often
shared between two cars - Lotus ran the 78 and the 79 through 1978 - and no
rule for splitting a championship between chassis is defensible. Races, wins,
poles and fastest laps ARE derived, from the race records, at build time.
"""

WIKI = "https://en.wikipedia.org/wiki/"

CARS = [
    # ------------------------------------------------------------ the 1950s
    ("alfa-158", "alfa-romeo", "158/159", "Alfa Romeo 158/159 Alfetta", 1950, 1951, None,
     "Gioacchino Colombo", "alfa-eng", "Alfa Romeo 158/159 straight-8", "Pirelli",
     "supercharged straight-8", 1479, "supercharged", 420,
     "Over 300 bhp as the 158 in 1950; about 420 bhp at 9,600 rpm as the 159 in 1951",
     9600,
     "tubular frame", "Alfa 5-speed manual",
     "Front: trailing arm, transverse leaf springs. Rear: swing axle with transverse leaf spring, replaced by a de Dion axle on the 159",
     "drum", 710.0, 2502, None, None, None,
     "A pre-war voiturette design, hidden through the war and brought back to win the first two World Championships",
     "Nothing new: the point of the 158 is that a 1938 design was still the best car in the world in 1951",
     "Alfa entered 1950 with a car designed twelve years earlier and won every race it started. By 1951 it was drinking fuel at about 1.5 miles per gallon and needed two stops where the Ferrari 375 needed one; Fangio won the title anyway, at Barcelona, when Ferrari picked the wrong tyre size. Alfa then withdrew from Grand Prix racing entirely rather than build a successor, which is why 1952 and 1953 were run to Formula Two rules.",
     "Every race entered in 1950; 4 of 7 in 1951. Drivers' titles for Farina and Fangio.",
     2, 0, 1, "high", "high", WIKI + "Alfa_Romeo_158/159_Alfetta"),

    ("ferrari-500", "ferrari", "500", "Ferrari 500", 1952, 1953, None,
     "Aurelio Lampredi", "ferrari-eng", "Ferrari Lampredi straight-4", "Pirelli",
     "straight-4", 1985, "naturally aspirated", 185,
     "The 2.0-litre Formula Two engine; the related 625 F1 car took the same design out to 2,498 cc and 210-230 hp",
     7200,
     "tubular frame", None,
     "Front: independent, transverse leaf springs with Houdaille dampers. Rear: de Dion axle",
     "drum", None, None, None, None, None,
     "A Formula Two car that won two World Championships because the championship came to it",
     None,
     "When Alfa withdrew after 1951 there were not enough Formula One cars left to fill a grid, so the 1952 and 1953 championships were run to Formula Two rules. Ferrari already had the best Formula Two car. Ascari won every championship race he entered in 1952 bar the Indianapolis 500, and all but the last in 1953: seven straight wins, a record that stood for sixty years until Vettel beat it in 2013.",
     "Ascari's back-to-back titles, 1952 and 1953.",
     2, 0, 1, "high", "medium", WIKI + "Ferrari_500"),

    ("mercedes-w196", "mercedes", "W196", "Mercedes-Benz W196", 1954, 1955, None,
     "Rudolf Uhlenhaut", "mercedes-eng", "Mercedes-Benz M196 straight-8", "Continental",
     "straight-8", 2497, "naturally aspirated", 290,
     "257 bhp on debut, developed towards 290-300 bhp; a 340 bhp target at 10,000 rpm was never reached in a race",
     8500,
     "welded aluminium tube spaceframe", None,
     "Front: double wishbone with torsion bars. Rear: low-pivot swing axle with torsion bars",
     "inboard drum", None, None, None, None, None,
     "Aircraft engineering applied to a racing car: direct fuel injection, desmodromic valves, and a full-width streamliner body",
     "Direct fuel injection taken from Daimler-Benz aero engines; desmodromic valve gear, which closes the valves mechanically instead of with springs and so removes the rev ceiling that valve float imposes; inboard brakes; the Type Monza streamliner",
     "The only closed-wheel car ever to win a World Championship race, and it won three. Mercedes ran the streamliner at fast circuits and an open-wheel body elsewhere after Fangio complained he could not place the front wheels at Silverstone. The programme ended abruptly after Le Mans 1955, where a Mercedes sports car went into the crowd and killed more than eighty people; Mercedes did not return to Formula One as a constructor until 2010.",
     "9 wins from 12 races entered. Fangio's titles in 1954 and 1955.",
     2, 0, 1, "high", "high", WIKI + "Mercedes-Benz_W196"),

    ("maserati-250f", "maserati", "250F", "Maserati 250F", 1954, 1960, None,
     "Gioacchino Colombo, Vittorio Bellentani, Alberto Massimino", "maserati-eng",
     "Maserati A6 straight-6", "Pirelli",
     "straight-6", 2493, "naturally aspirated", 240,
     "220 bhp at 7,400 rpm in 1954, about 240 bhp with fuel injection from 1955; a 315 bhp V12 was offered in 1957 and rarely used",
     7400,
     "aluminium tubular ladder frame", "4-speed, later 5-speed manual",
     "Front: independent wishbone. Rear: de Dion tube",
     "drum", None, None, None, None, None,
     "The customer car of the 2.5-litre era: not the fastest, but the one anyone could buy and almost anyone could drive",
     None,
     "The 250F is the reason the mid-1950s grids existed at all - Maserati sold them to privateers and they filled out every race for six seasons. Fangio's 1957 German Grand Prix in one is the drive the sport keeps coming back to: a botched pit stop dropped him 48 seconds behind, and he took it all back in 22 laps, breaking the lap record ten times and passing Hawthorn on the last lap.",
     "8 championship wins across 1954-1960. Fangio's 1954 and 1957 titles.",
     2, 0, 1, "high", "medium", WIKI + "Maserati_250F"),

    ("vanwall-vw5", "vanwall", "VW5", "Vanwall VW5", 1956, 1958, None,
     "Colin Chapman (chassis), Frank Costin (aerodynamics), Leo Kuzmicki (engine)",
     None, "Vanwall straight-4", "Dunlop",
     "straight-4", 2489, "naturally aspirated", 290,
     "About 290 bhp at 7,500 rpm on methanol; 255-262 bhp under the 1958 pump-fuel rules",
     7500,
     "spaceframe", "5-speed manual with Porsche synchromesh",
     "Front: torsion bars. Rear: de Dion axle",
     "disc", None, None, None, None, None,
     "A motorcycle engine multiplied by four in an aircraft-aerodynamicist's body on a Chapman chassis",
     "Bosch fuel injection; Costin's streamlined body, which made it the fastest car in a straight line; four cylinders derived from Norton motorcycle practice",
     "Tony Vandervell built Vanwall to beat 'those bloody red cars', and did. The 1957 British Grand Prix, shared by Moss and Brooks, was the first World Championship win for a British car. In 1958 Vanwall took the first Constructors' Championship ever awarded - and then Vandervell's health failed and the team effectively stopped, so the first constructors' champion never defended the title.",
     "The first Constructors' Championship, 1958. Six wins that season, three each to Moss and Brooks - and no drivers' title, which went to Hawthorn's Ferrari on consistency.",
     0, 1, 1, "high", "medium", WIKI + "Vanwall"),

    ("cooper-t51", "cooper", "T51", "Cooper T51", 1959, 1960, None,
     "Owen Maddock", "climax", "Coventry Climax FPF straight-4", "Dunlop",
     "straight-4", 2495, "naturally aspirated", 240, None, 6750,
     "steel spaceframe", "Citroen-derived or Colotti manual",
     "Front: double wishbone, coil spring and damper. Rear: transverse leaf spring with double wishbone",
     "drum", 701.0, 2642, 1397, 1346, None,
     "Put the engine behind the driver and the whole car gets smaller, lighter and faster with less power",
     "Not the first rear-engined Grand Prix car, but the one that settled the argument",
     "Cooper's rear-engined cars had been winning with half the power of a front-engined Ferrari since 1958, and the establishment kept explaining why it did not matter. Brabham's 1959 title ended the discussion: within three seasons every car on the grid had the engine behind the driver, and no front-engined car has won a World Championship race since 1960.",
     "5 wins. Brabham's 1959 drivers' title and Cooper's 1959 constructors' title - the first for a rear-engined car.",
     1, 1, 1, "high", "high", WIKI + "Cooper_T51"),

    # ------------------------------------------------------------ the 1960s
    ("lotus-25", "lotus", "25", "Lotus 25", 1962, 1965, None,
     "Colin Chapman", "climax", "Coventry Climax FWMV V8", "Dunlop",
     "90-degree V8", 1498, "naturally aspirated", 195, None, 8500,
     "aluminium monocoque", "ZF 5DS10 5-speed manual",
     "Front: double wishbone, inboard coilover. Rear: lower wishbone, top link and radius rod, outboard coilover",
     "disc", None, None, None, None, None,
     "Replace the tube frame with a stressed aluminium skin: half the weight, three times the stiffness",
     "The first fully stressed monocoque chassis in Formula One, and an extremely low, narrow body around a reclined driving position",
     "Chapman is said to have sketched it on a napkin. The spaceframe it replaced was a lattice of tubes that had to be triangulated around the driver; the monocoque made the driver's compartment itself the structure. Frontal area came down to 8 square feet. Every serious Formula One car since has been a monocoque of one material or another, and the 25 is the reason.",
     "14 wins and 14 poles. Clark's 1963 and 1965 titles, with Lotus taking the constructors' championship both years.",
     2, 2, 1, "high", "high", WIKI + "Lotus_25"),

    ("lotus-49", "lotus", "49", "Lotus 49", 1967, 1970, "lotus-25",
     "Colin Chapman, Maurice Philippe", "cosworth", "Ford Cosworth DFV V8", "Firestone, Dunlop",
     "90-degree V8", 2993, "naturally aspirated", 430,
     "420-440 bhp at 9,000-10,000 rpm through its life", 10000,
     "aluminium monocoque", "Hewland-Lotus 5-speed manual",
     "Front: double wishbone with inboard spring/damper. Rear: top link, lower wishbone and radius rods",
     "disc", 501.0, 2413, 1524, 1549, None,
     "Bolt the engine straight to the back of the tub and let it be the back of the car",
     "The engine as a fully stressed structural member, carrying the rear suspension; and, from 1968, aerofoil wings mounted on struts to the uprights",
     "Ford paid Cosworth £100,000 to build the DFV and gave Lotus a year of exclusivity. Clark won first time out at Zandvoort. When the exclusivity lapsed the DFV was sold to anyone who asked, and it went on to win 155 Grands Prix - the reason a small British team with no engine of its own could beat Ferrari for the next fifteen years. The 49 also carried the first wings, which appeared at Monaco in 1968 and were mounted so high and so flimsily that two of them collapsed at Montjuic in 1969.",
     "12 wins, 19 poles. Hill's 1968 title and Rindt's posthumous 1970 title.",
     2, 2, 1, "high", "high", WIKI + "Lotus_49"),

    ("lotus-72", "lotus", "72", "Lotus 72", 1970, 1975, "lotus-49",
     "Colin Chapman, Maurice Philippe, Tony Rudd", "cosworth", "Ford Cosworth DFV V8",
     "Firestone, Goodyear",
     "90-degree V8", 2993, "naturally aspirated", 450,
     "440-465 bhp at 10,000-10,800 rpm", 10800,
     "aluminium monocoque", "Hewland FG400 5-speed manual",
     "Front: double wishbone, inboard spring/damper. Rear: parallel top links, lower wishbones, twin radius arms, outboard spring/damper",
     "inboard disc", None, None, None, None, None,
     "Move the mass to the middle, get the radiators out of the nose, and make the whole car a wedge",
     "Side-mounted radiators in the sidepods, freeing the nose to be a pure aerodynamic wedge; inboard brakes to cut unsprung weight; torsion-bar suspension with anti-dive and anti-squat geometry",
     "Twelve miles an hour quicker than the 49 on the same engine. The 72 raced for six seasons, which nothing else of its era managed, and it won the 1970 title for a driver who had died at Monza with four rounds to go - Rindt remains the only posthumous World Champion.",
     "75 races, 20 wins, 17 poles. Drivers' titles for Rindt (1970) and Fittipaldi (1972); constructors' in 1970, 1972 and 1973.",
     2, 3, 1, "high", "high", WIKI + "Lotus_72"),

    ("ferrari-312b", "ferrari", "312B", "Ferrari 312B", 1970, 1975, None,
     "Mauro Forghieri", "ferrari-eng", "Ferrari Tipo 001 flat-12", "Firestone, Goodyear",
     "flat-12", 2992, "naturally aspirated", 460, None, 11500,
     "aluminium monocoque", "Ferrari Type 621 5-speed manual",
     "Front: double wishbone, inboard spring/damper. Rear: double wishbone",
     "disc", None, None, None, None, None,
     "A flat-12 sits low, so the centre of gravity sits low, and the engine can still be a stressed member",
     "The 180-degree flat-12 that Ferrari would use until turbos arrived in 1980",
     "Forghieri's flat-12 was the answer to the DFV: more power, and mounted so low that it lowered the whole car around it. Its drawback was width, which fought the ground-effect sidepods that arrived at the end of the decade - the reason Ferrari struggled in 1979-80 while Williams and Lotus flew.",
     "10 wins across the 312B, B2 and B3. The B3-74 took Lauda to the 1975 title and Ferrari to the constructors'.",
     1, 1, 1, "high", "medium", WIKI + "Ferrari_312B"),

    # ------------------------------------------------------------ the 1970s
    ("mclaren-m23", "mclaren", "M23", "McLaren M23", 1973, 1978, None,
     "Gordon Coppuck, John Barnard, Dave Quill", "cosworth", "Ford Cosworth DFV V8", "Goodyear",
     "90-degree V8", 2993, "naturally aspirated", 465, None, 10800,
     "aluminium monocoque", "Hewland FG400 5/6-speed manual",
     "Front: double wishbone with inboard coilovers. Rear: double wishbone",
     "disc", None, 2565, None, None, None,
     "A deformable-structure chassis built to the new 1973 safety rules, developed for six years without ever being replaced",
     None,
     "The M23 won titles three years apart with two different drivers and was still scoring points in its sixth season. Hunt's 1976 championship in it - won by a point after Lauda's Nurburgring crash and withdrawal at a flooded Fuji - is the season most people who do not follow the sport have still heard of.",
     "83 races, 16 wins, 14 poles. Fittipaldi's 1974 title and McLaren's first constructors' championship, then Hunt's 1976 title.",
     2, 1, 1, "high", "high", WIKI + "McLaren_M23"),

    ("ferrari-312t", "ferrari", "312T", "Ferrari 312T", 1975, 1980, "ferrari-312b",
     "Mauro Forghieri", "ferrari-eng", "Ferrari Tipo 015 flat-12", "Goodyear, Michelin",
     "flat-12", 2992, "naturally aspirated", 510,
     "500-515 bhp at 12,500 rpm", 12500,
     "steel tube frame with aluminium shear panels", "transverse 5-speed manual",
     "Front and rear double wishbone, front inboard spring/damper",
     "disc", None, None, None, None, None,
     "Turn the gearbox sideways and put it ahead of the rear axle line: the mass moves forward and the car turns better",
     "The transverse gearbox - the T in the name is trasversale - which concentrated mass within the wheelbase",
     "The 312T line ran for six seasons and five designations and is the most successful thing Ferrari built before the Schumacher era. The 312T2 is the car Lauda crashed at the Nurburgring in 1976 and the car he was back in six weeks later. By the 312T5 in 1980 the flat-12 was too wide for ground effect and the car was hopeless - Ferrari finished tenth in the championship, and went turbo.",
     "89 races, 27 wins, 19 poles. Drivers' titles for Lauda (1975, 1977) and Scheckter (1979); constructors' in 1975, 1976, 1977 and 1979.",
     3, 4, 1, "high", "high", WIKI + "Ferrari_312T"),

    ("tyrrell-p34", "tyrrell", "P34", "Tyrrell P34", 1976, 1977, None,
     "Derek Gardner", "cosworth", "Ford Cosworth DFV V8", "Goodyear",
     "90-degree V8", 2993, "naturally aspirated", 465, None, 10800,
     "aluminium monocoque", "Hewland FG400 5-speed, 6-speed in 1977",
     "Double wishbone front and rear, coil springs over dampers, anti-roll bars",
     "disc", 595.0, 2453, None, None, None,
     "Four small front wheels hide inside the body: less frontal area, more braking and cornering rubber",
     "Six wheels, with four 10-inch front tyres",
     "It worked. Scheckter and Depailler finished first and second at Anderstorp in 1976 and Tyrrell was third in the championship. It stopped working because Goodyear had no reason to keep developing a tyre size only one team used, so the front tyres fell behind while everyone else's improved. The 1977 car was heavier and slower, the idea was dropped, and the rules were later changed to require exactly four wheels.",
     "30 races, 1 win, 1 pole, 14 podiums - the only six-wheeled car ever to win a World Championship race.",
     0, 0, 1, "high", "high", WIKI + "Tyrrell_P34"),

    ("renault-rs01", "renault", "RS01", "Renault RS01", 1977, 1979, None,
     "Andre de Cortanze, Jean-Pierre Jabouille, Francois Castaing", "renault-eng",
     "Renault-Gordini EF1 turbo V6", "Michelin",
     "90-degree turbo V6", 1492, "turbocharged", 510,
     "About 510 bhp at 11,000 rpm; a single turbo at first, twin turbos later to attack the lag",
     11000,
     "aluminium monocoque", "Hewland FGA 400 6-speed manual",
     None, "disc", 605.0, None, None, None, None,
     "The rules allow 1.5 litres with a turbocharger against 3.0 without; nobody has tried it, so try it",
     "The first turbocharged engine in Formula One, and the first radial tyres",
     "It was slow, it was unreliable, and rival teams called it the yellow teapot for the cloud of white smoke it produced when it let go, which was often. It never won. But by 1983 every serious car had a turbo, by 1986 there was nothing else on the grid, and the naturally aspirated 3.0-litre engine that had defined Formula One since 1966 was gone.",
     "25 races, no wins, one pole. The RS10 that followed it won at Dijon in 1979 - the first turbo victory.",
     0, 0, 1, "high", "high", WIKI + "Renault_RS01"),

    ("lotus-78", "lotus", "78", "Lotus 78", 1977, 1978, "lotus-72",
     "Colin Chapman, Tony Rudd, Ralph Bellamy, Peter Wright, Martin Ogilvie",
     "cosworth", "Ford Cosworth DFV V8", "Goodyear",
     "90-degree V8", 2993, "naturally aspirated", 465, None, 10800,
     "aluminium honeycomb monocoque", "Hewland FG400 5-speed manual",
     "Front: double wishbone, inboard spring/damper. Rear: parallel top links, lower wishbones, twin radius arms",
     "disc", 588.0, 2741, 1702, 1600, None,
     "Shape the underside of the sidepods as inverted wings and seal the edges: the car makes downforce without making drag",
     "Ground effect, and sliding skirts to seal the low-pressure area at the car's edges",
     "Wings make downforce and pay for it in drag. Peter Wright's insight was that the whole underbody could be a wing instead, and that the ground itself would double the effect if the sides were sealed. The 78 was quick everywhere and unbeatable in slow corners. It should have won the 1977 championship and did not, because the DFV kept failing.",
     "7 wins and 9 poles across 1977 and early 1978, before the 79 replaced it.",
     0, 0, 1, "high", "high", WIKI + "Lotus_78"),

    ("lotus-79", "lotus", "79", "Lotus 79", 1978, 1979, "lotus-78",
     "Colin Chapman, Tony Rudd, Tony Southgate, Peter Wright, Martin Ogilvie, Geoff Aldridge",
     "cosworth", "Ford Cosworth DFV V8", "Goodyear",
     "90-degree V8", 2993, "naturally aspirated", 475,
     "475 bhp at 11,000 rpm", 11000,
     "aluminium monocoque, strengthened for ground-effect loads", "Hewland FG400 5-speed manual",
     "Front: double wishbone, inboard spring/damper. Rear: parallel top links, lower wishbones, twin radius arms, outboard spring/damper",
     "disc", None, None, None, None, None,
     "The 78 idea done properly: everything moved out of the airflow under the car so the tunnels run clean from front to back",
     "Full ground effect, with the fuel moved to a single central cell and the rear suspension repackaged to clear the diffuser exits",
     "The 78 proved the principle; the 79 removed everything that got in its way. Andretti said it was like being painted to the road. It was so far ahead that Chapman had already moved on to the 80, which failed, and then to the twin-chassis 88, which was banned - Lotus never won another championship. Every team copied the 79 for 1979, and Williams and Ligier did it better.",
     "26 races, 6 wins, 10 poles. Andretti's 1978 title and Lotus's seventh and last constructors' championship.",
     1, 1, 1, "high", "high", WIKI + "Lotus_79"),

    ("brabham-bt46", "brabham", "BT46", "Brabham BT46 and BT46B", 1978, 1979, None,
     "Gordon Murray", "alfa-eng", "Alfa Romeo 115-12 flat-12", "Goodyear",
     "flat-12", 2995, "naturally aspirated", 520,
     "520 bhp at 12,000 rpm", 12000,
     "aluminium alloy monocoque", "Brabham 5/6-speed manual with Hewland gears",
     "Pullrod double wishbones front and rear",
     "disc", None, 2590, 1549, 1626, None,
     "If a flat-12 is too wide for ground-effect tunnels, make the downforce a different way: extract the air from under the car with a fan",
     "Surface heat exchangers in place of radiators on the original BT46 (which did not work); on the BT46B, an engine-driven fan drawing air from a skirted underbody",
     "The fan was declared to be for cooling, which was true for about 30 per cent of what it did. Lauda won the 1978 Swedish Grand Prix by half a minute and the car was never raced again: Ecclestone owned Brabham and was building his position in FOCA, and the other team principals made withdrawing it the price. It remains the only car to win every Grand Prix it entered.",
     "The BT46B won the one race it started. The conventional BT46 won at Monza the same year.",
     0, 0, 1, "high", "high", WIKI + "Brabham_BT46"),

    ("williams-fw07", "williams", "FW07", "Williams FW07", 1979, 1982, None,
     "Patrick Head, Neil Oatley, Frank Dernie", "cosworth", "Ford Cosworth DFV V8",
     "Goodyear, Michelin",
     "90-degree V8", 2993, "naturally aspirated", 505,
     "500-510 bhp at 11,400 rpm with the Judd-prepared DFVs from 1980", 11400,
     "aluminium monocoque", "Hewland FGB, later FGA 400 5-speed manual",
     "Lower wishbones with inboard springs front and rear",
     "disc", 579.0, None, None, None, None,
     "The Lotus 79 concept, engineered properly and made stiff enough to hold its skirts on the ground",
     "Dernie's work on keeping the skirts sealed at all times, worth a claimed 30 per cent in downforce",
     "Williams took the 79's idea and out-built its inventor. The FW07 turned a team that had never won a race into a two-time constructors' champion in three seasons and set the pattern for Williams for the next twenty years: someone else's concept, executed better.",
     "43 races, 15 wins, 8 poles. Jones's 1980 drivers' title; constructors' championships in 1980 and 1981.",
     1, 2, 1, "high", "high", WIKI + "Williams_FW07"),

    # ------------------------------------------------------------ the 1980s
    ("mclaren-mp4-1", "mclaren", "MP4/1", "McLaren MP4/1", 1981, 1983, None,
     "John Barnard, Alan Jenkins, Steve Nichols", "cosworth", "Ford Cosworth DFV V8",
     "Michelin",
     "90-degree V8", 2993, "naturally aspirated", 510,
     "510 bhp at 11,000 rpm; a TAG-Porsche turbo V6 of about 700 bhp was fitted late in 1983",
     11000,
     "carbon-fibre composite monocoque", "McLaren/Hewland FGA 400 5-speed manual",
     None, "disc", None, None, None, None, None,
     "Aluminium is not stiff enough to carry ground-effect loads; build the tub out of carbon fibre instead",
     "The first carbon-fibre composite monocoque to race in Formula One",
     "Barnard got the idea from Rolls-Royce engineers using carbon fibre in turbofan blades, and had the tub built by Hercules Aerospace in Utah because nobody in motor racing could make one. The paddock thought it would shatter. Then John Watson crashed heavily at Monza in 1981, the car broke apart around a tub that stayed intact, and he walked away. Every car on the grid was carbon-fibre within a few years, and it is the single largest reason drivers stopped dying.",
     "43 races, 6 wins. No championships - its importance is structural, not competitive.",
     0, 0, 1, "high", "high", WIKI + "McLaren_MP4/1"),

    ("lotus-88", "lotus", "88", "Lotus 88", 1981, 1981, "lotus-79",
     "Colin Chapman, Peter Wright, Tony Rudd, Martin Ogilvie", "cosworth",
     "Ford Cosworth DFV V8", "Michelin, Goodyear",
     "90-degree V8", 2993, "naturally aspirated", 490, None, 11000,
     "twin carbon-fibre composite chassis", "Lotus/Hewland 5-speed manual",
     "Top rocker arms, lower wishbones, inboard springs front and rear",
     "disc", None, None, None, None, None,
     "Two chassis, one inside the other: the outer one takes the aerodynamic load and runs stiff, the inner one carries the driver and rides softly",
     "The twin-chassis principle, and one of the first extensive uses of carbon fibre in a chassis",
     "Ground-effect cars had to run rock-hard suspension to keep the skirts sealed, which by 1981 was punishing enough to hurt drivers. Chapman's answer separated the two jobs. Rival teams protested that the sprung outer body was a movable aerodynamic device; the car was excluded from three race weekends and never started a Grand Prix. It is the clearest case in the sport's history of a rule stopping a genuinely good idea, and Chapman's disgust at it is usually read as the beginning of the end of Lotus.",
     "Never raced. Ran in practice at Long Beach, Rio and Silverstone in 1981 and was excluded each time.",
     0, 0, 1, "high", "high", WIKI + "Lotus_88"),

    ("mclaren-mp4-4", "mclaren", "MP4/4", "McLaren MP4/4", 1988, 1988, "mclaren-mp4-1",
     "Gordon Murray, Steve Nichols, Matthew Jeffreys, Bob Bell", "honda-eng",
     "Honda RA168E turbo V6", "Goodyear",
     "80-degree turbo V6", 1494, "turbocharged", 675,
     "675 bhp at 12,500 rpm, restricted to 2.5 bar boost and 150 litres of fuel by the 1988 rules",
     12500,
     "carbon-fibre honeycomb monocoque", "Weismann-McLaren 6-speed manual",
     "Front: double wishbones, pull/push-rod actuated coil springs and dampers. Rear: double wishbones, rocker-arm actuated",
     "carbon disc", None, 2875, None, None, None,
     "Murray's very low Brabham packaging, Honda's last and best turbo, and the two fastest drivers alive",
     None,
     "In the final year of turbos, with boost and fuel cut hard, McLaren won 15 of 16 races and led 1,003 of 1,031 laps. The one it lost was Monza, two laps from the end, when Senna hit a backmarker while leading - five weeks after Enzo Ferrari's death, and Ferrari finished first and second. Senna and Prost took 199 of a possible 240 points between them and did not speak civilly again for years.",
     "15 wins, 15 poles and 10 fastest laps from 16 races. Senna's first title and McLaren's constructors' championship.",
     1, 1, 1, "high", "high", WIKI + "McLaren_MP4/4"),

    # ------------------------------------------------------------ the 1990s
    ("williams-fw14", "williams", "FW14", "Williams FW14 and FW14B", 1991, 1992, "williams-fw07",
     "Patrick Head, Adrian Newey, Paddy Lowe, Frank Dernie", "renault-eng",
     "Renault RS3C / RS4 V10", "Goodyear",
     "67-degree V10", 3493, "naturally aspirated", 750,
     "700-750 bhp at 12,500-14,500 rpm", 14500,
     "carbon-fibre and honeycomb composite monocoque", "Williams 6-speed sequential semi-automatic",
     "Pushrod with inboard spring/dampers in 1991; computer-controlled active suspension front and rear on the 1992 FW14B",
     "carbon disc", None, None, None, None, None,
     "Give the computer control of the ride height and the car holds its best aerodynamic attitude everywhere, all the time",
     "Active suspension, traction control, semi-automatic gearbox and anti-lock brakes on one car",
     "The FW14B is the most technologically advanced car ever to race in Formula One, and it is the reason so much of it is now banned. Mansell won the first five races of 1992 and took the title with five rounds left. Active suspension, traction control and launch control were all outlawed for 1994, which is how a technical arms race ends.",
     "17 wins and 21 poles across the two years. Mansell's 1992 title with nine wins in a season, and the 1992 constructors' championship.",
     1, 1, 1, "high", "high", WIKI + "Williams_FW14"),

    # ------------------------------------------------------------ the 2000s
    ("ferrari-f2004", "ferrari", "F2004", "Ferrari F2004", 2004, 2004, None,
     "Ross Brawn, Rory Byrne, Aldo Costa, John Iley, Paolo Martinelli", "ferrari-eng",
     "Ferrari Tipo 053 V10", "Bridgestone",
     "90-degree V10", 2997, "naturally aspirated", 865,
     "865 bhp at 18,300 rpm in race trim; 900-940 bhp at 19,000 rpm in qualifying",
     18800,
     "carbon-fibre and honeycomb composite monocoque",
     "Ferrari 7-speed sequential semi-automatic",
     "Independent front and rear, pushrod-activated torsion springs",
     "carbon disc", None, None, None, None, None,
     "The last and best of the V10s, at the end of five years of Ferrari getting everything slightly more right than everyone else",
     None,
     "The F2004 still holds outright lap records at circuits that have not been reprofiled since, which is a strange thing to be able to say about a car from 2004 - modern cars are heavier, on worse tyres, with less engine. It was the end of the run: Schumacher's seventh title, Ferrari's sixth straight constructors' championship, and then the tyre rules changed and it stopped.",
     "20 races, 15 wins, 12 poles, 14 fastest laps. Schumacher's seventh drivers' title and Ferrari's 2004 constructors' championship.",
     1, 1, 1, "high", "high", WIKI + "Ferrari_F2004"),

    ("renault-r25", "renault", "R25", "Renault R25", 2005, 2005, None,
     "Bob Bell, Pat Symonds, James Allison, Tim Densham, Dino Toso", "renault-eng",
     "Renault RS25 V10", "Michelin",
     "72-degree V10", 2998, "naturally aspirated", 850,
     "800-900 bhp at 19,000 rpm", 19000,
     "carbon-fibre monocoque", "Renault 6-speed sequential semi-automatic",
     "Pushrod-activated torsion bars front and rear, plus a tuned mass damper in the nose from late 2005",
     "carbon disc", 605.0, 3100, None, None, None,
     "A well-balanced car on Michelins, plus a weight on a spring in the nose to stop the front tyres skipping over bumps",
     "The tuned mass damper: a sprung mass in the nose oscillating out of phase with the front suspension, keeping the tyres in contact with the road",
     "The mass damper was worth about three tenths of a second and was completely legal until the FIA decided in 2006 that a mass that is not rigidly attached counts as a movable aerodynamic device. Renault won the 2005 titles and broke a run of five consecutive Ferrari championships doing it.",
     "19 races, 8 wins, 7 poles. Alonso's first title, at 24 the youngest champion to that point, and Renault's first constructors' championship.",
     1, 1, 1, "high", "high", WIKI + "Renault_R25"),

    ("brawn-bgp001", "brawn", "BGP 001", "Brawn BGP 001", 2009, 2009, None,
     "Ross Brawn, Jorg Zander, Loic Bigois, John Owen, Masayuki Minagawa (double diffuser)",
     "mercedes-eng", "Mercedes-Benz FO 108W V8", "Bridgestone",
     "90-degree V8", 2400, "naturally aspirated", 750,
     "750 bhp at 18,000 rpm, the regulation rev limit", 18000,
     "moulded carbon-fibre and honeycomb composite monocoque",
     "Brawn 7-speed semi-automatic",
     "Wishbone and pushrod-activated torsion springs and rockers, front and rear",
     "carbon disc", None, None, None, None, None,
     "Read the 2009 aerodynamic rewrite more carefully than anyone else and find a second deck in the diffuser that the wording does not forbid",
     "The double diffuser, developed at Honda and inherited when Honda withdrew",
     "Honda spent a fortune on the 2009 car and then pulled out of Formula One in December 2008. Brawn bought the team for a pound, fitted a Mercedes engine to a chassis designed around a Honda one, and won six of the first seven races. Rivals protested the diffuser and lost at the FIA International Court of Appeal in April. It is the only team to have won the championship in the only season it ever existed - Mercedes bought it at the end of the year.",
     "17 races, 8 wins, 5 poles. Button's title and the constructors' championship, from a team that did not exist in January and did not exist in the following year.",
     1, 1, 1, "high", "high", WIKI + "Brawn_BGP_001"),

    # ------------------------------------------------------------ the 2010s
    ("red-bull-rb6", "red-bull", "RB6", "Red Bull RB6", 2010, 2010, None,
     "Adrian Newey, Rob Marshall, Peter Prodromou, Dan Fallows", "renault-eng",
     "Renault RS27 V8", "Bridgestone",
     "90-degree V8", 2400, "naturally aspirated", 750,
     "750 bhp at 18,000 rpm, the regulation rev limit", 18000,
     "carbon-fibre and honeycomb composite monocoque, engine a fully stressed member",
     "Red Bull 7-speed semi-automatic",
     "Aluminium uprights with carbon-composite double wishbones; pushrod front, pullrod rear",
     "carbon disc", 620.0, None, None, None, None,
     "Point the exhausts into the diffuser so the car makes downforce from engine gas as well as airflow",
     "The exhaust-blown diffuser, taken further than anyone else and eventually to off-throttle blowing, which kept the effect alive when the driver lifted",
     "Fifteen poles from nineteen races - the car was on another level over one lap and merely very good over a race distance. Vettel took the championship at the last round in Abu Dhabi having led the standings for exactly none of the season until it ended. Exhaust blowing was progressively restricted and then banned for 2014.",
     "19 races, 9 wins, 15 poles. Vettel's first title and Red Bull's first constructors' championship.",
     1, 1, 1, "high", "high", WIKI + "Red_Bull_RB6"),

    ("mercedes-w05", "mercedes", "W05", "Mercedes F1 W05 Hybrid", 2014, 2014, None,
     "Bob Bell, Aldo Costa, Geoff Willis, John Owen, Mike Elliott, Loic Serra",
     "mercedes-eng", "Mercedes-Benz PU106A Hybrid turbo V6", "Pirelli",
     "90-degree turbo V6 hybrid", 1600, "turbocharged hybrid", 840,
     "About 840 bhp combined at up to 15,000 rpm, from a 1.6-litre V6 plus MGU-K and MGU-H",
     15000,
     "moulded carbon-fibre and honeycomb composite monocoque",
     "Mercedes/Xtrac 8-speed sequential semi-automatic",
     "Carbon-fibre wishbones, pushrod front and pullrod rear, actuating torsion springs",
     "carbon disc", 691.0, None, None, None, None,
     "Split the turbocharger in half and put the compressor at the front of the V and the turbine at the back, joined by a shaft through the vee",
     "The split-turbo layout, which shortened the intake path, cooled the charge air better and packaged the whole power unit tighter than anything else on the grid",
     "The 2014 hybrid rules were the biggest engine change since 1989 and Mercedes had understood them years earlier. The split turbo is the single decision that bought them the next eight constructors' championships: Ferrari and Renault had to redesign around it and were years catching up. Hamilton and Rosberg won 16 of 19 races and finished first and second in the championship.",
     "19 races, 16 wins, 18 poles. Hamilton's second title and the first of eight consecutive Mercedes constructors' championships.",
     1, 1, 1, "high", "high", WIKI + "Mercedes_F1_W05_Hybrid"),

    # ------------------------------------------------------------ the 2020s
    ("mercedes-w11", "mercedes", "W11", "Mercedes F1 W11 EQ Performance", 2020, 2020,
     "mercedes-w05",
     "James Allison, John Owen, Mike Elliott, Loic Serra, Eric Blandin", "mercedes-eng",
     "Mercedes-Benz M11 EQ Performance turbo V6", "Pirelli",
     "90-degree turbo V6 hybrid", 1600, "turbocharged hybrid", 1000,
     "Around 1,000 bhp combined, the peak of the first hybrid formula", 15000,
     "moulded carbon-fibre and honeycomb composite monocoque",
     "Mercedes 8-speed sequential semi-automatic",
     "Carbon-fibre wishbones with pushrod front and pullrod rear, plus Dual Axis Steering",
     "carbon disc", 746.0, None, None, None, None,
     "Let the driver change the front wheel toe angle by pulling the steering wheel towards him on the straights",
     "Dual Axis Steering (DAS), which traded straight-line drag against cornering grip and tyre warm-up within a lap",
     "DAS was spotted on television during pre-season testing, ruled legal for 2020 and banned for 2021 in the same breath. The W11 won 13 of 17 races in a season compressed and reordered by the pandemic, and holds the outright lap record at most circuits it visited.",
     "17 races, 13 wins, 15 poles. Hamilton's seventh title, equalling Schumacher, and Mercedes's seventh consecutive constructors' championship.",
     1, 1, 1, "high", "medium", WIKI + "Mercedes_F1_W11"),

    ("red-bull-rb19", "red-bull", "RB19", "Red Bull RB19", 2023, 2023, "red-bull-rb6",
     "Adrian Newey, Pierre Wache, Craig Skinner, Enrico Balbo", "rbpt",
     "Honda RBPTH001 turbo V6", "Pirelli",
     "90-degree turbo V6 hybrid", 1600, "turbocharged hybrid", 1000, None, 15000,
     "carbon-fibre composite monocoque", "Red Bull 8-speed semi-automatic",
     "Pushrod front, pullrod rear, with carbon-composite wishbones",
     "carbon disc", 798.0, None, None, None, None,
     "The most complete exploitation of the 2022 ground-effect rules: low drag on the straights without giving anything up in the corners",
     None,
     "Twenty-one wins from twenty-two races, beating the MP4/4's 93.8 per cent with 95.5 per cent, and leading 86.7 per cent of all laps run. The one it lost was Singapore. Verstappen won ten in a row, a record. It is the most dominant single season any car has had, and it happened under a cost cap that was supposed to prevent exactly this.",
     "22 races, 21 wins. Verstappen's third title and Red Bull's sixth constructors' championship.",
     1, 1, 1, "high", "medium", WIKI + "Red_Bull_RB19"),
]


# ---------------------------------------------------------------------
# Which car a constructor raced in which season.
#
# A (car_id, year) pair asserts: every race this constructor won, took pole
# for or set fastest lap in, that season, was in this car. That is a strong
# claim and it is not made where a team ran two cars in one year - Lotus in
# 1970 (49C and 72), Cooper in 1960 (T51 and T53), Williams in 1982 (FW07C
# and FW08). Those seasons are simply absent, and the entries stay unlinked.
#
# The claim is CHECKED, not trusted. EXPECTED below gives each car's wins and
# poles as published on its own reference page; build.py derives the same two
# figures from the race records once these links are made, and verify.py
# fails if they disagree. A wrong year here shows up immediately as a wrong
# win count.
# ---------------------------------------------------------------------
CAR_SEASONS = [
    ("alfa-158", 1950), ("alfa-158", 1951),
    ("ferrari-500", 1952), ("ferrari-500", 1953),
    ("mercedes-w196", 1954), ("mercedes-w196", 1955),
    ("vanwall-vw5", 1957), ("vanwall-vw5", 1958),
    ("cooper-t51", 1959),
    ("lotus-25", 1963),
    ("lotus-78", 1977),
    ("lotus-49", 1967), ("lotus-49", 1968), ("lotus-49", 1969),
    ("lotus-72", 1971), ("lotus-72", 1972), ("lotus-72", 1973), ("lotus-72", 1974),
    ("mclaren-m23", 1974), ("mclaren-m23", 1975), ("mclaren-m23", 1976),
    ("mclaren-m23", 1977),
    ("ferrari-312t", 1975), ("ferrari-312t", 1976), ("ferrari-312t", 1977),
    ("ferrari-312t", 1978), ("ferrari-312t", 1979), ("ferrari-312t", 1980),
    ("williams-fw07", 1979), ("williams-fw07", 1980), ("williams-fw07", 1981),
    ("mclaren-mp4-4", 1988),
    ("williams-fw14", 1991), ("williams-fw14", 1992),
    ("ferrari-f2004", 2004),
    ("renault-r25", 2005),
    ("brawn-bgp001", 2009),
    ("red-bull-rb6", 2010),
    ("mercedes-w05", 2014),
    ("mercedes-w11", 2020),
    ("red-bull-rb19", 2023),
]

# car_id -> (wins, poles) as published on the car's own reference page:
# CAREER figures, across every season the car raced.
#
# How these are checked (verify.py):
#   wins  - a car cannot have won more races than its reference total, so
#           derived <= published always. Where CAR_SEASONS covers every year
#           of the car's life, the two must be EQUAL.
#   poles - derived <= published only. The pole harvest records who took pole
#           but not what they drove, so 655 of 1,161 pole entries carry no
#           constructor and cannot be linked to a car. The derived pole count
#           is therefore a lower bound by construction, not an error. This is
#           in known_gaps.
EXPECTED = {
    "mercedes-w196": (9, None),
    "vanwall-vw5": (9, None),
    "cooper-t51": (5, 6),
    "lotus-25": (14, 14),
    "lotus-78": (7, 9),
    "lotus-49": (12, 19),
    "lotus-72": (20, 17),
    "mclaren-m23": (16, 14),
    "ferrari-312t": (27, 19),
    "williams-fw07": (15, 8),
    "mclaren-mp4-4": (15, 15),
    "williams-fw14": (17, 21),
    "ferrari-f2004": (15, 12),
    "renault-r25": (8, 7),
    "brawn-bgp001": (8, 5),
    "red-bull-rb6": (9, 15),
    "mercedes-w05": (16, 18),
    "mercedes-w11": (13, 15),
    "red-bull-rb19": (21, None),
}


# ---------------------------------------------------------------------
# Which chassis in the register each curated car covers.
#
# `cars` and `chassis` are different units and this is the join between
# them. A car here is a design family, because that is how the sport and its
# reference pages treat one: "Ferrari 312T" means the 312T through the 312T5,
# and Wikipedia redirects every one of those titles to a single article. F1DB
# registers each machine separately - ferrari-312t, ferrari-312t2,
# ferrari-312t2b, ferrari-312t3, ferrari-312t4, ferrari-312t4b, ferrari-312t5.
#
# Twenty-nine lines, written out and checked one at a time, which is what
# CONTRIBUTING.md allows a person to do. The 1,153-row register itself came
# through a loader.
#
# verify.py checks every id here exists in the register, that its constructor
# agrees with the car's, that no chassis is claimed by two cars, and that the
# seasons the register records for it fall inside the car's stated life. A
# typo cannot survive any of those.
# ---------------------------------------------------------------------
CAR_CHASSIS = {
    "alfa-158": ["alfa-romeo-158", "alfa-romeo-159"],
    "ferrari-500": ["ferrari-500"],
    "mercedes-w196": ["mercedes-w196"],
    "maserati-250f": ["maserati-250f"],
    "vanwall-vw5": ["vanwall-vw-5"],
    "cooper-t51": ["cooper-t51"],
    "lotus-25": ["lotus-25"],
    "lotus-49": ["lotus-49", "lotus-49b", "lotus-49c"],
    # F1DB has no bare `lotus-72`: the 1970 car is registered from the 72B on.
    "lotus-72": ["lotus-72b", "lotus-72c", "lotus-72d", "lotus-72e"],
    "ferrari-312b": ["ferrari-312b", "ferrari-312b2", "ferrari-312b3",
                     "ferrari-312b3-74"],
    "mclaren-m23": ["mclaren-m23", "mclaren-m23b", "mclaren-m23c",
                    "mclaren-m23d", "mclaren-m23e"],
    "ferrari-312t": ["ferrari-312t", "ferrari-312t2", "ferrari-312t2b",
                     "ferrari-312t3", "ferrari-312t4", "ferrari-312t4b",
                     "ferrari-312t5"],
    "tyrrell-p34": ["tyrrell-p34"],
    "renault-rs01": ["renault-rs01"],
    "lotus-78": ["lotus-78"],
    "lotus-79": ["lotus-79"],
    "brabham-bt46": ["brabham-bt46", "brabham-bt46b", "brabham-bt46c"],
    "williams-fw07": ["williams-fw07", "williams-fw07b", "williams-fw07c",
                      "williams-fw07d"],
    "mclaren-mp4-1": ["mclaren-mp4-1", "mclaren-mp4-1b", "mclaren-mp4-1c",
                      "mclaren-mp4-1e"],
    # Both 88s were entered and neither was allowed to race.
    "lotus-88": ["lotus-88", "lotus-88b"],
    "mclaren-mp4-4": ["mclaren-mp4-4"],
    "williams-fw14": ["williams-fw14", "williams-fw14b"],
    # The F2004M is the 2005 interim car and falls outside this row's
    # 2004-2004 life, so it is not claimed here.
    "ferrari-f2004": ["ferrari-f2004"],
    "renault-r25": ["renault-r25"],
    "brawn-bgp001": ["brawn-bgp-001"],
    "red-bull-rb6": ["red-bull-rb6"],
    "mercedes-w05": ["mercedes-f1-w05"],
    "mercedes-w11": ["mercedes-f1-w11"],
    "red-bull-rb19": ["red-bull-rb19"],
}


# ---------------------------------------------------------------------
# Figures withdrawn from a car row because they turned out to describe the
# regulations rather than the car.
#
# Four of the sixteen weights originally researched here were the season's
# regulation minimum. That is not a transcription error - it is what most
# published "weight" figures for a Formula One car actually are, because a
# team builds to the limit and does not publish what it achieved. Storing one
# in a per-car field is inference presented as fact, which is the failure this
# project has hit twice before by other routes.
#
# They are recorded here rather than quietly deleted: `verify.py` asserts the
# field really is NULL now, and build.py writes each into `discrepancies`, so
# the removal is visible and reversible if a real measurement ever turns up.
# The limits themselves are in data/technical.py REGULATION_LIMITS.
#
# Six more weights are almost certainly the same thing - R25 605, RB6 620,
# W05 691, W11 746, RB19 798, and the 2005 carry-over - but this project does
# not withdraw a figure on a suspicion. They stay until a SOURCED limit for
# those seasons proves them, which is open work.
#
#   car_id, field, withdrawn_value, reason
# ---------------------------------------------------------------------
WITHDRAWN = [
    ("mclaren-m23", "weight_kg", 575.0,
     "575 kg is the minimum weight imposed for 1973 and still in force in "
     "1980, not a measurement of the M23."),
    ("lotus-88", "weight_kg", 585.0,
     "585 kg is the 1981 minimum weight, raised that year with the survival "
     "cell requirement. The 88 was never allowed to race, so a measured "
     "weight for it would be a curiosity in any case."),
    ("mclaren-mp4-4", "weight_kg", 540.0,
     "540 kg is the 1988 minimum weight, raised that season with the "
     "mandatory static crash test. The MP4/4's real weight is not "
     "established."),
    ("ferrari-f2004", "weight_kg", 605.0,
     "605 kg is the 2004 minimum in qualifying trim, including driver and "
     "fuel. Every car on the 2004 grid was built to it."),
]


def seasons_complete(car_id, from_year, to_year):
    """True when CAR_SEASONS asserts every year of the car's life, so the
    derived win count must equal the published one rather than merely not
    exceed it."""
    if from_year is None:
        return False
    have = {y for c, y in CAR_SEASONS if c == car_id}
    want = set(range(from_year, (to_year or from_year) + 1))
    return bool(have) and want <= have
