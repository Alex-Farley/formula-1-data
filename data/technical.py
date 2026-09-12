# -*- coding: utf-8 -*-
"""
Regulatory, technical, safety and governance history.
"""

# year, category, title, detail, impact
REGULATIONS = [
    (1950, "sporting", "World Championship established", "The FIA created a Drivers' World Championship over six European Grands Prix plus the Indianapolis 500.", "Turned a loose calendar of national Grands Prix into a single competition."),
    (1950, "sporting", "Points to the top five plus fastest lap", "8-6-4-3-2 with one point for fastest lap, shared if tied. Only a driver's best four results counted.", "Dropped scores would remain in some form until 1990."),
    (1952, "technical", "Championship run to Formula 2", "2.0 L naturally aspirated, adopted for 1952-53 after Alfa Romeo's withdrawal left too few competitive F1 cars.", "Ascari won every race he entered across the two years."),
    (1954, "technical", "2.5 L naturally aspirated formula", "New capacity limit; supercharging limited to 750 cc and effectively abandoned.", "Drew Mercedes and Lancia into the championship."),
    (1958, "sporting", "International Cup for F1 Manufacturers", "The first Constructors' Championship, awarded to Vanwall.", "Made the constructor, not just the driver, a championship competitor."),
    (1958, "sporting", "Commercial fuel mandated", "Avgas replaced exotic alcohol fuel blends; race distances cut from 500 km to 300 km.", "Cut power and cost, and shortened races to roughly two hours."),
    (1961, "technical", "1.5 L formula", "Capacity halved and a minimum weight of 450 kg imposed.", "Fiercely opposed by British teams, who were unprepared; Ferrari dominated 1961."),
    (1966, "technical", "3.0 L formula", "Capacity doubled, or 1.5 L with forced induction.", "'The return of power'; the Cosworth DFV followed in 1967."),
    (1968, "sporting", "Commercial sponsorship permitted", "The FIA allowed liveries other than national racing colours.", "Gold Leaf Team Lotus appeared in red, white and gold. The sport's commercial model begins here."),
    (1969, "technical", "High wings banned mid-season", "Following strut failures for both Lotus drivers at Barcelona, tall aerofoils on unsprung mountings were outlawed.", "Aerodynamic devices were henceforth required to be fixed to the sprung mass and limited in height."),
    (1970, "safety", "Mandatory deformable structure and fuel bag tanks", "Crushable structures around fuel cells and self-sealing bag tanks required.", "Directly reduced fire deaths, the era's dominant killer."),
    (1972, "technical", "Airbox regulations and safety structures", "Rollover bar dimensions specified; onboard fire extinguishers and electrical cut-off required.", ""),
    (1973, "safety", "Deformable structures around the cockpit", "Side crash structures mandated.", ""),
    (1976, "technical", "Tall airboxes banned", "Mid-season ban following the airbox height arms race.", ""),
    (1977, "technical", "First turbocharged car", "Renault exploited the long-dormant 1.5 L forced-induction option with the RS01.", "Began an eleven-year turbo arms race."),
    (1981, "sporting", "First Concorde Agreement", "Settled the FISA-FOCA war over commercial rights and rule-making between the governing body, the teams and the commercial rights holder.", "Established the tripartite governance model that still applies."),
    (1981, "technical", "Sliding skirts banned; 6 cm ride height minimum", "Aimed at killing ground effect.", "Circumvented by hydropneumatic suspension that lowered the car at speed."),
    (1983, "technical", "Flat bottoms mandated", "Underbody had to be flat between the axles, ending Venturi tunnels.", "Cornering speeds fell sharply; downforce moved back to wings."),
    (1984, "technical", "Refuelling banned; 220 litre fuel limit", "Race fuel capped to restrain turbo power.", "Turbo engines were detuned for races and unleashed in qualifying."),
    (1986, "technical", "Naturally aspirated engines outlawed", "Turbo-only season, the sole one in the sport's history.", ""),
    (1987, "technical", "4.0 bar boost limit; naturally aspirated cars readmitted", "3.5 L atmospheric engines permitted alongside boost-limited turbos, with separate trophies.", "Began the managed phase-out of turbos."),
    (1988, "technical", "2.5 bar boost limit and 150 litre fuel limit", "Final year of turbo eligibility.", "McLaren-Honda still won 15 of 16 races."),
    (1989, "technical", "Turbocharging banned", "3.5 L naturally aspirated only.", "Ended the highest-power era in the sport's history."),
    (1990, "sporting", "Dropped scores abolished", "All results counted towards the championship for the first time.", "Simplified the championship and ended the era of gross-versus-net point totals."),
    (1994, "sporting", "Refuelling reintroduced", "Mid-race refuelling permitted from 1994.", "Made race strategy a central competitive variable for sixteen years."),
    (1994, "technical", "Electronic driver aids banned", "Active suspension, traction control, ABS, four-wheel steering and launch control outlawed.", "Cars became markedly harder to drive; the enforcement difficulty led to traction control being legalised again in 2001."),
    (1994, "safety", "Emergency in-season rule changes", "After Imola: plank under the floor, reduced airbox and diffuser, larger cockpit opening, restricted front wing endplates.", "The most abrupt safety intervention in the sport's history."),
    (1995, "technical", "3.0 L capacity limit", "Engine capacity cut from 3.5 L.", "A direct response to the 1994 accidents."),
    (1996, "safety", "Higher cockpit sides mandated", "Head protection raised around the cockpit rim.", ""),
    (1998, "technical", "Narrow-track cars and grooved tyres", "Track cut from 2.0 m to 1.8 m; three grooves front and four rear.", "Cut cornering speed at the expense of mechanical grip."),
    (2001, "technical", "Traction control legalised", "Reinstated from the Spanish GP because the ban had become unpoliceable.", "Banned again in 2008 with the standard ECU."),
    (2003, "sporting", "Points to the top eight; single-lap qualifying", "10-8-6-5-4-3-2-1 introduced; parc ferme rules restricted set-up changes after qualifying.", "Deliberately designed to reduce Ferrari's margin."),
    (2003, "sporting", "Team orders banned", "Following the 2002 Austrian GP, orders that interfere with a race result were prohibited.", "Repealed in 2011 as unenforceable."),
    (2005, "sporting", "One engine per two race weekends; tyre changes banned", "Engines had to last two events; tyres could not be changed during a race.", "The tyre rule was abandoned after the 2005 US GP fiasco."),
    (2006, "technical", "2.4 L V8 engines", "V10s replaced to cut power and cost.", ""),
    (2007, "sporting", "Single tyre supplier", "Bridgestone became the sole supplier after Michelin's withdrawal.", "Ended tyre-war development and made tyres a controlled variable."),
    (2008, "technical", "Standard ECU", "A single McLaren Electronic Systems ECU for all cars.", "Made traction control and engine braking control enforceable to ban."),
    (2009, "technical", "Aerodynamic overhaul and KERS", "Wide low front wing, narrow high rear wing, most bodywork appendages removed; optional 60 kW kinetic energy recovery.", "First serious attempt to design for following another car. The double-diffuser loophole dominated the season."),
    (2010, "sporting", "Refuelling banned; new points system", "Race refuelling prohibited; 25-18-15-12-10-8-6-4-2-1 introduced with the field expanded to 24 cars.", "Fuel loads at the start became a major performance factor."),
    (2011, "technical", "DRS and Pirelli high-degradation tyres", "A driver-adjustable rear wing usable within one second of the car ahead in designated zones, and tyres designed to fall off deliberately.", "Both were explicit attempts to manufacture overtaking; both remain contested on sporting-purity grounds."),
    (2014, "technical", "1.6 L V6 turbo-hybrid power units", "ERS with MGU-K and MGU-H, 100 kg fuel limit and 100 kg/h flow limit; five power-unit elements per season.", "The most radical technical change in the sport's history. Thermal efficiency passed 50%. Development costs pushed several independent engine builders out."),
    (2014, "sporting", "Double points at the finale", "The last race awarded double points.", "Used once, universally disliked, and dropped."),
    (2015, "safety", "Virtual Safety Car", "A field-wide delta-time speed restriction introduced after Jules Bianchi's accident at Suzuka.", "Allows yellow-flag conditions to be enforced without bunching the field."),
    (2017, "technical", "Wider cars and tyres", "Cars widened to 2.0 m, wider tyres, larger diffuser and lower rear wing.", "Lap records fell across the calendar; following became harder."),
    (2018, "safety", "Halo mandated", "A titanium cockpit protection structure able to withstand 12 tonnes.", "Initially unpopular on aesthetic grounds; credited with saving Leclerc at Spa 2018, Grosjean at Bahrain 2020 and Zhou at Silverstone 2022."),
    (2019, "sporting", "Point for fastest lap", "One point for the fastest lap, if finishing in the top ten.", "Removed again from 2025."),
    (2021, "financial", "Cost cap introduced", "A budget cap of $145 m for 2021, excluding driver salaries, marketing and the three highest-paid staff.", "The most consequential governance change since the Concorde Agreement; designed to compress the competitive order."),
    (2021, "sporting", "Sprint format trialled", "Three events ran a short Saturday race setting the grid, with points to the top three.", "Extended to six events; sprint results decoupled from the Grand Prix grid from 2024."),
    (2022, "technical", "Ground effect returns", "Venturi tunnels reinstated with simplified over-body aerodynamics, 18-inch wheels and standardised parts.", "Intended to let cars follow closely. Porpoising — aerodynamic bouncing — dominated the first season and forced a mid-2022 technical directive on floor stiffness and a vertical-oscillation metric."),
    (2023, "sporting", "Floor edge and stiffness rules tightened", "Floor edges raised and diffuser throat height increased to curb porpoising.", ""),
    (2025, "sporting", "Fastest lap point removed", "The bonus point introduced in 2019 was dropped.", "Removed an incentive for late 'free' pit stops by out-of-contention cars."),
    (2026, "financial", "Cost cap set at US$215 million", "US$215,000,000 for a reporting year of up to 24 Competitions, plus US$1,800,000 for each Competition above 24, in the 2026 Financial Regulations (Section D, issue 07); 2025 was US$135,000,000 at 21 Competitions.", "The first change to the headline figure since 2023. The schedule year by year is in regulation_limits."),
    (2026, "technical", "New chassis formula", "Wheelbase capped at 3,400 mm, width reduced to 1,900 mm, minimum weight 768 kg (722 kg car and driver plus 46 kg estimated tyre mass in the FIA overview).", "The first deliberate reduction in car size and weight in decades."),
    (2026, "technical", "Active aerodynamics replace DRS", "Driver-operable front and rear wing systems with distinct low-drag and high-downforce modes.", "Removes the DRS proximity mechanism in favour of a mode both cars can use."),
    (2026, "sporting", "Overtake Mode", "A driver within one second at the detection point receives additional energy deployment — the FIA/F1 overview describes an extra 0.5 MJ and a raised deployment profile.", "The successor mechanism to DRS's overtaking assistance."),
    (2026, "technical", "MGU-H removed", "The turbo-driven heat-energy recovery unit is deleted from the power unit.", "Cut cost and complexity; explicitly credited with attracting Audi, Ford and General Motors."),
    (2026, "technical", "Roughly 50/50 power split", "Electrical output raised to approximately 350 kW, against a comparable figure from the internal combustion engine.", ""),
    (2026, "technical", "100% advanced sustainable fuel", "Fully sustainable drop-in fuel mandated.", "The sport's principal decarbonisation claim for the ruleset."),
    (2026, "safety", "Tougher homologation tests", "Roll-hoop vertical impact requirement raised from 16 g to 20 g; a two-stage nose-cone concept introduced.", ""),
]

# year, innovation, originator, description, legacy, banned_year
INNOVATIONS = [
    (1950, "Mid-engined layout (in embryo)", "Cooper", "Cooper's rear-engined 500 cc cars scaled up to Grand Prix racing by 1958-59.", "Universal from 1961; every F1 car since has had the engine behind the driver.", None),
    (1954, "Desmodromic valves and fuel injection", "Mercedes-Benz W196", "Positively closed valves and direct fuel injection derived from aero-engine work.", "Injection became universal; desmodromics did not.", None),
    (1962, "Monocoque chassis", "Lotus 25 (Colin Chapman)", "A stressed-skin aluminium tub replacing the spaceframe.", "Halved chassis weight and roughly trebled torsional stiffness. Now universal, in carbon fibre.", None),
    (1967, "The Cosworth DFV as a stressed member", "Lotus 49 / Cosworth", "The engine bolted directly to the rear of the monocoque and carried the suspension loads.", "Made the small independent constructor viable for two decades.", None),
    (1968, "Aerofoil wings", "Lotus and Ferrari", "Inverted aerofoils generating downforce.", "The single most important performance concept in the sport's history.", None),
    (1970, "Side-mounted radiators", "Lotus 72", "Radiators moved from the nose to the flanks, giving a wedge profile and cleaner front-end airflow.", "Standard layout ever since.", None),
    (1976, "Six-wheeled car", "Tyrrell P34", "Four small front wheels to cut frontal area while retaining braking and grip.", "Won the 1976 Swedish GP. Tyre development killed it; four-wheel cars mandated from 1983.", 1983),
    (1977, "Ground effect", "Lotus 78/79 (Peter Wright, Colin Chapman)", "Inverted-wing underbody profiles with sliding skirts sealing the low-pressure area.", "Transformed cornering speed. Banned in 1983, reintroduced in modified form in 2022.", 1983),
    (1977, "Turbocharging", "Renault RS01", "1.5 L forced-induction engine exploiting a long-ignored rule.", "Defined 1980s F1 and produced the highest power figures ever seen in the sport.", 1989),
    (1978, "Fan car", "Brabham BT46B (Gordon Murray)", "A fan, nominally for cooling, extracting air from beneath the car to generate suction.", "Won its only race, the 1978 Swedish GP, and was withdrawn under pressure.", 1978),
    (1981, "Carbon-fibre monocoque", "McLaren MP4/1 (John Barnard)", "The first F1 chassis made from carbon composite.", "Vastly stronger and lighter than aluminium; the foundation of modern survival-cell safety. Universal within four years.", None),
    (1989, "Semi-automatic gearbox", "Ferrari 640 (John Barnard)", "Electrohydraulic paddle-shift with no clutch pedal for upshifts.", "Universal by the mid-1990s.", None),
    (1992, "Active suspension", "Williams FW14B", "Computer-controlled hydraulic ride height maintaining optimum aerodynamic platform.", "Devastatingly effective; banned for 1994.", 1994),
    (1997, "Brake steer", "McLaren MP4/12", "A second brake pedal acting on one rear wheel to rotate the car.", "Banned once revealed, as a four-wheel-steering device.", 1998),
    (1998, "Mass damper", "Renault R25/R26", "A sprung mass in the nose damping tyre oscillation and stabilising the aerodynamic platform.", "Banned mid-2006 as a movable aerodynamic device.", 2006),
    (2003, "Twin-keel and zero-keel front suspension", "Various", "Front wishbone mounting philosophies to clean up airflow under the nose.", "Superseded by pull-rod and high-nose concepts.", None),
    (2009, "Double diffuser", "Brawn, Toyota, Williams", "A second-tier diffuser exploiting a gap in the wording of the 2009 rules.", "Effectively decided the 2009 championship; banned for 2011.", 2011),
    (2009, "KERS", "Multiple", "60 kW kinetic energy recovery under braking.", "The bridgehead to the hybrid era.", None),
    (2010, "F-duct", "McLaren MW23", "A driver-operated duct stalling the rear wing on the straights for less drag.", "Banned for 2011 as a movable aerodynamic device operated by the driver.", 2011),
    (2010, "Blown diffuser", "Red Bull RB6", "Exhaust gases routed into the diffuser to energise it, including off-throttle.", "Progressively restricted 2011-2013 through exhaust position rules.", 2014),
    (2011, "DRS", "FIA regulation", "Driver-adjustable rear wing within one second of the car ahead.", "Replaced by active aerodynamics and Overtake Mode in 2026.", 2026),
    (2014, "Split-turbo layout", "Mercedes PU106A", "Compressor at the front of the engine and turbine at the rear, joined by a shaft through the vee, with the MGU-H between them.", "Gave Mercedes a package advantage that took rivals several seasons to answer.", None),
    (2014, "Pre-chamber / jet ignition combustion", "Mercedes and others", "A small pre-combustion chamber igniting an ultra-lean main charge.", "Took thermal efficiency past 50%, roughly double a typical road petrol engine.", None),
    (2017, "Bargeboard complexity", "Multiple", "Elaborate flow-conditioning structures ahead of the sidepods.", "Largely legislated away for 2022 to reduce wake sensitivity.", 2022),
    (2020, "DAS (dual-axis steering)", "Mercedes W11", "Pushing and pulling the steering column altered front wheel toe on the move.", "Legal in 2020, explicitly banned for 2021.", 2021),
    (2022, "Zero-sidepod concept", "Mercedes W13", "A radical narrow-sidepod interpretation of the ground-effect rules.", "Abandoned after two seasons; a rare example of a distinctive concept that simply did not work.", None),
]

# year, milestone, trigger_event, description
SAFETY = [
    (1961, "Fuel and crowd control questions raised", "Von Trips's Monza crash killing 15 spectators", "Spectator placement began to be treated as a design problem rather than a local matter."),
    (1967, "Grand Prix Drivers' Association reactivated", "Rising fatality rate", "Jackie Stewart's campaign for barriers, run-off, medical facilities and marshalling standards begins in earnest."),
    (1968, "Full-face helmets and rollover bars", "Multiple fatalities including Clark, Spence, Schlesser and Bandini", "Rollover protection specified; full-face helmets adopted."),
    (1970, "Bag fuel tanks and deformable structures", "Fire deaths through the 1960s", "Self-sealing fuel cells became mandatory."),
    (1972, "Six-point harnesses and onboard extinguishers", None, "Standardised restraint and fire suppression."),
    (1973, "Deformable side structures", "Roger Williamson's death in a fire at Zandvoort with no marshal intervention", "Marshalling and fire-crew standards overhauled alongside the car rules."),
    (1977, "Permanent medical car and travelling medical delegate", "Tom Pryce's death at Kyalami", "Professor Sid Watkins appointed in 1978; a doctor now travels with the championship."),
    (1978, "Standardised race-start procedure and medical helicopter", "Ronnie Peterson's death after a delayed extraction at Monza", "A helicopter capable of flying must be on site or the race does not start."),
    (1981, "Survival cell strength test", None, "Minimum crash structure ahead of the driver's feet."),
    (1985, "Frontal crash test introduced", None, "Cars had to pass a static and then dynamic impact test to be eligible."),
    (1988, "Driver's feet behind the front axle line", None, "Ended the practice of pedals ahead of the front wheels."),
    (1994, "Comprehensive post-Imola overhaul", "Deaths of Senna and Ratzenberger, injuries to Wendlinger, Barrichello and Lehto", "Immediate aerodynamic cuts, then a multi-year programme: higher cockpit sides, larger cockpit template, wheel tethers, stronger side impact structures, and the FIA Institute's crash-research programme."),
    (1996, "Raised cockpit sides", None, "Head and neck protection around the cockpit rim."),
    (1997, "Wheel tethers", "Wheels leaving cars in accidents", "Tethers to retain wheels; strengthened repeatedly since, with double tethers from 2011."),
    (1999, "Higher cockpit sides and headrest energy absorption", None, ""),
    (2003, "HANS device mandated", "Basilar skull fractures in motorsport worldwide", "Head and neck support tethering the helmet to the shoulders; the single most effective driver-protection device of its generation."),
    (2005, "Stronger side-impact and rear-impact structures", None, ""),
    (2009, "Zylon anti-penetration visor panel", "Felipe Massa struck by a loose spring at the Hungaroring; Henry Surtees killed in F2", "A ballistic strip added to helmet visors."),
    (2011, "Double wheel tethers", None, ""),
    (2014, "Virtual Safety Car and closed pit-lane research", "Jules Bianchi's accident at Suzuka", "VSC introduced for 2015; the accident also began the closed-cockpit research programme."),
    (2015, "Standardised recovery-vehicle procedures", "Bianchi", "Recovery vehicles may not be on track without VSC or safety car."),
    (2018, "Halo", "Bianchi's death and the Justin Wilson and Henry Surtees fatalities in other categories", "A titanium structure withstanding 12 tonnes, roughly the weight of a London bus. Credited with saving lives at Spa 2018, Bahrain 2020 and Silverstone 2022."),
    (2019, "Stronger chassis and higher-load survival cell", None, "Front and side impact loads increased substantially."),
    (2021, "Roll hoop load test increase", None, "Preceded further increases after Zhou Guanyu's 2022 Silverstone crash, in which the roll hoop failed."),
    (2022, "Aeroscreen research and roll-hoop redesign", "Zhou Guanyu's inverted crash at Silverstone", "Roll-hoop homologation revised to eliminate pointed designs that could dig into the surface."),
    (2026, "Roll-hoop vertical test raised to 20 g", None, "Up from 16 g, alongside a two-stage nose-cone concept in the 2026 framework."),
]

# ---------------------------------------------------------------------
# Numeric limits the regulations impose on every car in a season.
#
# These exist as a table of their own for one reason. Modern Formula One
# cars are documented far more thinly than historic ones: current-era
# specifications are competitive secrets, and most "weight" quoted for a
# recent car is simply that season's regulation minimum. The 2026 figures in
# circulation - 768 kg, a 3,400 mm wheelbase, 1,900 mm of width - are limits
# in the rules, not measurements of any particular car.
#
# Putting one of them in a per-car field would be inference presented as
# fact, which is the failure this project has already hit twice. So a
# regulation limit is stored here, where it applies to the whole grid, and
# tools/wikispec_fetch.py drops a harvested car figure that merely restates
# one. A car field left NULL means the car's own figure is not established.
#
# A row covers from_year..to_year inclusive. `to_year` is set ONLY where the
# source records the next change; where it does not, the row covers the one
# year it was stated for and stops. Carrying a value forward across a change
# the source does not mention would invent a limit. That is why the series
# has holes - 1989-2003, 2005-2012, 2014-2016, 2018-2023 - and the holes are
# the honest shape of what has been established, not an oversight.
#
# from_year, to_year, field, value, unit, note, confidence, source
# ---------------------------------------------------------------------
_HFOR = "https://en.wikipedia.org/wiki/History_of_Formula_One_regulations"
_FIA2026 = "https://www.fia.com/regulations/formula-1"

# The FIA Financial Regulations, one issue per reporting year. Each states the
# cap for its own year in Article 2 - "in the event that N Competitions take
# place ... US Dollars X" - with the per-Competition adjustment beside it. The
# figures below were read from these documents, not from a summary of them.
# The FIA Sporting Regulations for 2025, issue 5 (30 April 2025), read for the
# weekend's limits: Article 30.5 (tyre sets per driver per Competition),
# 61.2 / 62.2 (classification) and the 107% rule in the qualifying articles.
_SPORT2025 = "https://www.fia.com/system/files/documents/fia_2025_formula_1_sporting_regulations_-_issue_5_-_2025-04-30.pdf"

_FIN = {
    2021: "https://www.fia.com/sites/default/files/formula_1_-_financial_regulations_-_2021_-_iss_8_-_2021-10-15.pdf",
    2022: "https://www.fia.com/sites/default/files/fia_formula_1_financial_regulations_iss.12.pdf",
    2023: "https://www.fia.com/sites/default/files/fia_formula_1_financial_regulations_-_issue_18_-_2023-12-06.pdf",
    2024: "https://www.fia.com/sites/default/files/fia_formula_1_financial_regulations_-_issue_22_-_2024-12-11.pdf",
    2025: "https://www.fia.com/system/files/documents/2025_fia_formula_1_financial_regulations_-_issue_25_-_2025-07-31.pdf",
    2026: "https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_d_financial_-_f1_teams_-_iss_07_-_2026-06-25.pdf",
}

REGULATION_LIMITS = [
    (1961, 1965, "minimum_weight_kg", 450.0, "kg",
     "The first minimum weight in Formula One; there was none before 1961.",
     "reference", _HFOR),
    (1966, 1969, "minimum_weight_kg", 500.0, "kg",
     "Raised with the 3.0-litre formula.", "reference", _HFOR),
    (1970, 1971, "minimum_weight_kg", 530.0, "kg",
     "Raised alongside mandatory bladder fuel cells.", "reference", _HFOR),
    (1972, 1972, "minimum_weight_kg", 550.0, "kg",
     "Raised alongside safety foam in the fuel tanks.", "reference", _HFOR),
    (1973, 1980, "minimum_weight_kg", 575.0, "kg",
     "Raised with the mandatory crushable structure around the fuel tanks. "
     "The 1980 regulations restate it unchanged, which is what bounds this "
     "row rather than an assumption that nothing happened in between.",
     "reference", _HFOR),
    (1981, 1981, "minimum_weight_kg", 585.0, "kg",
     "Raised with the survival cell extending to the driver's feet.",
     "reference", _HFOR),
    (1982, 1982, "minimum_weight_kg", 580.0, "kg",
     "Reduced when rigid skirts were legalised.", "reference", _HFOR),
    (1983, 1986, "minimum_weight_kg", 540.0, "kg",
     "Reduced when ground-effect undertrays were outlawed.",
     "reference", _HFOR),
    (1987, 1987, "minimum_weight_kg", 500.0, "kg",
     "Reduced when naturally aspirated engines were re-allowed at 3,500 cc.",
     "reference", _HFOR),
    (1988, 1988, "minimum_weight_kg", 540.0, "kg",
     "Raised with the mandatory static crash test. The next change this "
     "source records is 2004, so the row stops here rather than carry a "
     "1988 figure through the 1990s.", "reference", _HFOR),
    (2004, 2004, "minimum_weight_kg", 605.0, "kg",
     "605 kg in qualifying, and not below 600 kg at any other time, "
     "including driver and fuel.", "reference", _HFOR),
    (2013, 2013, "minimum_weight_kg", 642.0, "kg",
     "The last year of the V8 formula. The hybrid rules raised it again for "
     "2014; this source does not give that figure, so the row stops here.",
     "reference", _HFOR),
    (2017, 2017, "minimum_weight_kg", 728.0, "kg",
     "Raised with the wider car and wider tyres.", "reference", _HFOR),
    (2024, 2024, "minimum_weight_kg", 798.0, "kg",
     "Recorded only because the 2025 change is stated as an increase FROM "
     "798 kg, which fixes the 2024 figure.", "reference", _HFOR),
    (2025, 2025, "minimum_weight_kg", 800.0, "kg",
     "Raised by 2 kg for the higher driver allowance and 5 kg for the "
     "mandated driver cooling system.", "reference", _HFOR),
    (2026, 2026, "minimum_weight_kg", 768.0, "kg",
     "The first deliberate weight reduction in decades: 722 kg of car and "
     "driver plus 46 kg of estimated tyre mass in the FIA overview. Every "
     "2026 car will be built to this number, so it says nothing about any "
     "one of them.", "reference", _FIA2026),

    (2017, 2025, "maximum_width_mm", 2000.0, "mm",
     "Widened from 1,800 mm for 2017; reduced again for 2026, which is what "
     "bounds this row.", "reference", _HFOR),
    (2026, 2026, "maximum_width_mm", 1900.0, "mm",
     "Part of the 2026 reduction in car size.", "reference", _FIA2026),
    (2026, 2026, "maximum_wheelbase_mm", 3400.0, "mm",
     "The first wheelbase cap in the modern rules. A 2026 car quoted at "
     "3,400 mm is being quoted the rule.", "reference", _FIA2026),

    # The cost cap. The headline figure is for a reporting year with the
    # stated number of Competitions; the second field is what each Competition
    # above or below that number adds or removes. The 2026 figure is not
    # comparable with 2025's on its face - the 2026 regulations were rewritten
    # as Section D of a single rulebook - so the two are separate rows rather
    # than one span with a note.
    (2021, 2021, "cost_cap_usd", 145_000_000.0, "USD",
     "For a 21-Competition reporting year (FIA Financial Regulations 2021, "
     "issue 8).", "reference", _FIN[2021]),
    (2022, 2022, "cost_cap_usd", 140_000_000.0, "USD",
     "For a 21-Competition reporting year (issue 12).", "reference", _FIN[2022]),
    (2023, 2025, "cost_cap_usd", 135_000_000.0, "USD",
     "For a 21-Competition reporting year. Issue 18 sets it for 2023 'and "
     "each subsequent' year; issues 22 and 25 restate it for 2024 and 2025.",
     "reference", _FIN[2023]),
    (2026, 2026, "cost_cap_usd", 215_000_000.0, "USD",
     "For a reporting year of 24 Competitions or fewer, under the 2026 "
     "Financial Regulations (Section D, issue 07).", "reference", _FIN[2026]),
    (2021, 2022, "cost_cap_per_competition_usd", 1_200_000.0, "USD",
     "Added or removed for each Competition above or below 21 (issue 8 "
     "states it for 2021 and 2022).", "reference", _FIN[2021]),
    (2023, 2025, "cost_cap_per_competition_usd", 1_800_000.0, "USD",
     "Added or removed for each Competition above or below 21.", "reference",
     _FIN[2025]),
    (2026, 2026, "cost_cap_per_competition_usd", 1_800_000.0, "USD",
     "Added for each Competition above 24.", "reference", _FIN[2026]),

    # The weekend's limits, from the 2025 Sporting Regulations. One season:
    # the years each of these changed are not yet read from earlier issues,
    # which is what WK-03 still holds open. A "Competition" is the FIA's
    # word for a Grand Prix weekend.
    (2025, 2025, "tyre_sets_dry_per_competition", 13.0, "sets",
     "Per driver, at a Competition without a sprint; twelve where a sprint "
     "is scheduled (Article 30.5).", "reference", _SPORT2025),
    (2025, 2025, "tyre_sets_intermediate_per_competition", 5.0, "sets",
     "Per driver per Competition (Article 30.5).", "reference", _SPORT2025),
    (2025, 2025, "tyre_sets_wet_per_competition", 2.0, "sets",
     "Per driver per Competition; three at Monaco (Article 30.5).",
     "reference", _SPORT2025),
    (2025, 2025, "classification_min_distance_pct", 90.0, "%",
     "A car that has covered less than 90% of the winner's laps, rounded "
     "down to whole laps, is not classified (Articles 61.2 and 62.2).",
     "reference", _SPORT2025),
    (2025, 2025, "qualifying_107_pct", 107.0, "%",
     "A driver eliminated in Q1 or SQ1 whose best lap exceeded 107% of the "
     "fastest in that session is unclassified unless the track was declared "
     "wet or the stewards permit a start.", "reference", _SPORT2025),
]


# supplier, from_year, to_year, exclusive, notes
TYRES = [
    ("Pirelli", 1950, 1958, 0, "Present at the championship's founding."),
    ("Dunlop", 1950, 1970, 0, "Dominant through the late 1950s and 1960s."),
    ("Englebert", 1950, 1958, 0, "Belgian supplier, closely associated with Ferrari."),
    ("Firestone", 1950, 1974, 0, "Present at Indianapolis from the start and in Grand Prix racing from 1966."),
    ("Goodyear", 1959, 1998, 0, "The most successful tyre supplier in the sport's history; sole supplier 1988-1996 apart from Pirelli's brief return."),
    ("Michelin", 1977, 2006, 0, "Introduced radial tyres to F1 in 1977. Withdrew after the 2005 Indianapolis failure and the 2006 season."),
    ("Pirelli", 1981, 1991, 0, "Second spell."),
    ("Bridgestone", 1997, 2010, 0, "Sole supplier 2007-2010 after Michelin's withdrawal."),
    ("Pirelli", 2011, None, 1, "Sole supplier since 2011, contracted to design deliberately high-degradation tyres to generate strategic variation."),
]

# from_year, to_year, scoring, fastest_lap, dropped_scores, notes
POINTS = [
    (1950, 1959, "8-6-4-3-2 to the top five", "1 point, shared equally if tied", "Best 4 of 7 (1950), varying through the decade",
     "Shared drives split the points equally between the drivers involved."),
    (1960, 1960, "8-6-4-3-2-1 to the top six", "None", "Best 6 of 10", "The fastest-lap point was dropped."),
    (1961, 1990, "9-6-4-3-2-1 to the top six", "None", "Varied: typically best n from each half of the season",
     "The long-running classic system. Dropped scores caused several championships to be decided on net rather than gross points, notably 1988."),
    (1991, 2002, "10-6-4-3-2-1 to the top six", "None", "None", "The win was revalued to discourage points-accumulation racing."),
    (2003, 2009, "10-8-6-5-4-3-2-1 to the top eight", "None", "None", "Widened deliberately to reduce Ferrari's dominance."),
    (2010, 2018, "25-18-15-12-10-8-6-4-2-1 to the top ten", "None", "None", "Introduced with the expansion to 24 cars."),
    (2019, 2024, "25-18-15-12-10-8-6-4-2-1 to the top ten", "1 point for fastest lap if classified in the top ten", "None", ""),
    (2025, None, "25-18-15-12-10-8-6-4-2-1 to the top ten", "None", "None", "The fastest-lap point was removed."),
]

SPRINT_POINTS = [
    (2021, 2021, "3-2-1 to the top three", "The sprint set the Grand Prix grid and its winner was credited with pole position."),
    (2022, None, "8-7-6-5-4-3-2-1 to the top eight", "From 2024 the sprint runs to its own qualifying session and no longer sets the Grand Prix grid."),
]

# from_year, to_year, era_name, summary, dominant_teams, defining_features
ERAS = [
    (1950, 1957, "The front-engined era", "Grand Prix racing resumed with pre-war machinery and pre-war attitudes to risk. Fangio won five titles in eight seasons.", "Alfa Romeo, Ferrari, Mercedes, Maserati", "Front engines, drum brakes, no seatbelts, treaded road-style tyres, races of 500 km"),
    (1958, 1965, "The rear-engine revolution", "Cooper put the engine behind the driver and the entire grid followed within three years. British 'garagiste' teams displaced the Italian manufacturers.", "Cooper, Lotus, BRM, Ferrari", "Mid-engined layout, monocoque chassis, the 1.5 L formula, the first Constructors' Championship"),
    (1966, 1976, "The DFV and the birth of aerodynamics", "The Cosworth DFV made independent constructors competitive; wings and then ground effect turned the car into an aerodynamic device. Fatality rates were at their worst.", "Lotus, Brabham, Tyrrell, Ferrari, McLaren", "3.0 L formula, wings, sponsorship liveries, the beginning of the safety movement"),
    (1977, 1988, "Ground effect and turbos", "Two revolutions at once: underbody downforce and forced induction. Power outputs reached figures never approached since.", "Lotus, Williams, Brabham, McLaren, Ferrari", "Venturi tunnels, sliding skirts, 1,400 bhp qualifying engines, carbon-fibre chassis"),
    (1989, 1997, "The electronic era and its aftermath", "Active suspension, traction control and semi-automatic gearboxes arrived and were then banned. The 1994 accidents redefined the sport's relationship with risk.", "McLaren, Williams, Benetton", "Driver aids and their prohibition, the post-Imola safety programme, refuelling"),
    (1998, 2008, "Ferrari's dominance and the manufacturer boom", "Schumacher and Ferrari won five consecutive titles; car makers poured in money.", "Ferrari, McLaren, Renault", "Grooved tyres, tyre wars, V10 then V8 engines, unlimited testing, escalating budgets"),
    (2009, 2013, "Aerodynamic ingenuity under constraint", "Rule packages designed to cut downforce were repeatedly outwitted — double diffusers, F-ducts, blown floors.", "Brawn, Red Bull", "KERS, DRS, exhaust-blown diffusers, the arrival of Pirelli's degradation tyres"),
    (2014, 2021, "The hybrid era", "The most complex power units ever raced, and the longest period of single-team dominance in the sport's history.", "Mercedes, Red Bull", "1.6 L V6 turbo hybrids, 50%+ thermal efficiency, eight consecutive Mercedes constructors' titles"),
    (2022, 2025, "Ground effect returns and the cost cap bites", "New aerodynamics intended to allow close following, alongside a budget cap that began to compress the field. Red Bull's 2023 was the most dominant season on record; by 2025 the top three drivers finished within thirteen points.", "Red Bull, McLaren", "Venturi tunnels, porpoising, 18-inch wheels, the $135-145 m cost cap, sprint weekends"),
    (2026, None, "The new formula", "A smaller, lighter car, an even power split between combustion and electrical energy, sustainable fuel, and two new manufacturers.", "TBD — Mercedes leads the opening half of 2026", "Active aerodynamics, Overtake Mode, no MGU-H, 100% sustainable fuel, twelve teams"),
]

# There is no RECORDS list here any more. The thirty rows it held were typed
# from general knowledge and one of them (Hamilton, 105 wins) contradicted the
# `drivers.wins` the same build computed. `records` is derived in build.py -
# see derive_records() - from the tables the site's leaderboards read.

GLOSSARY = [
    ("Apex", "driving", "The point at which a car is closest to the inside of a corner; the geometry of the apex determines corner entry and exit speed."),
    ("Blue flag", "flags", "Shown to a driver about to be lapped, requiring them to let the faster car past."),
    ("Bargeboard", "aerodynamics", "Vertical flow-conditioning surfaces between the front wheels and sidepods, largely legislated away for 2022."),
    ("Blistering", "tyres", "Tyre surface failure caused by overheating from the inside out."),
    ("Box", "strategy", "Radio instruction to pit, from the German 'Boxenstopp'; used because it is easier to hear than 'pit'."),
    ("Brake bias", "setup", "The front-to-rear distribution of braking force, adjustable from the cockpit."),
    ("Chicane", "circuit", "A tight sequence of corners inserted to slow cars, usually retrofitted for safety."),
    ("Clean air", "aerodynamics", "Undisturbed airflow; a car in clean air produces full downforce, one following closely does not."),
    ("Concorde Agreement", "governance", "The commercial and governance contract between the FIA, the commercial rights holder and the teams. First signed 1981."),
    ("Cost cap", "governance", "The annual spending limit on team operations, introduced in 2021 and excluding driver salaries, marketing and the three highest-paid staff."),
    ("Delta time", "sporting", "A target lap time drivers must not beat, used to enforce Virtual Safety Car conditions."),
    ("Dirty air", "aerodynamics", "The turbulent wake behind a car, which reduces the downforce of a car following closely."),
    ("DNF", "results", "Did Not Finish."),
    ("DRS", "aerodynamics", "Drag Reduction System, 2011-2025: a driver-adjustable rear wing flap usable within one second of the car ahead in designated zones."),
    ("Degradation", "tyres", "The loss of tyre performance over a stint, distinct from wear; Pirelli's tyres are specified to degrade deliberately."),
    ("Downforce", "aerodynamics", "Aerodynamically generated load pressing the car onto the track, increasing grip at the cost of drag."),
    ("ERS", "power unit", "Energy Recovery System: the electrical part of the power unit."),
    ("Flat spot", "tyres", "A locally worn patch on a tyre caused by locking a wheel under braking; produces vibration severe enough to force a pit stop."),
    ("Formation lap", "sporting", "The lap from the grid to the grid before the start, used to warm tyres and brakes."),
    ("Ground effect", "aerodynamics", "Downforce generated by accelerating airflow under the car through Venturi tunnels. Used 1977-1982 and again from 2022."),
    ("Halo", "safety", "The titanium cockpit protection structure mandated in 2018, able to withstand around 12 tonnes."),
    ("HANS", "safety", "Head and Neck Support device, mandatory since 2003, tethering the helmet to the shoulders to prevent basilar skull fracture."),
    ("Homologation", "technical", "FIA certification that a car, part or circuit meets the regulations."),
    ("Lift and coast", "driving", "Lifting off the throttle before the braking point to save fuel, energy or brake temperature."),
    ("MGU-K", "power unit", "Motor Generator Unit - Kinetic, recovering energy under braking and deploying it as drive."),
    ("MGU-H", "power unit", "Motor Generator Unit - Heat, recovering energy from exhaust gases via the turbocharger. Used 2014-2025 and removed for 2026."),
    ("Marbles", "tyres", "Discarded rubber off the racing line; drivers avoid it because it destroys grip."),
    ("Overtake Mode", "sporting", "The 2026 replacement for DRS: additional energy deployment for a car within one second at the detection point."),
    ("Parc ferme", "sporting", "The state, from the start of qualifying, in which set-up changes are prohibited without a pit-lane start."),
    ("Pit window", "strategy", "The lap range in which a stop makes strategic sense."),
    ("Plank", "technical", "The wooden (Jabroc) skid block under the floor, introduced in 1994 to enforce a minimum ride height. Excessive wear means disqualification."),
    ("Porpoising", "aerodynamics", "Violent vertical oscillation caused by ground-effect stall and recovery; the defining problem of the 2022 season."),
    ("Power unit", "power unit", "The full hybrid assembly since 2014: internal combustion engine, turbocharger, MGU-K, energy store and control electronics (plus MGU-H until 2026)."),
    ("Pole position", "sporting", "First place on the starting grid, awarded on qualifying time."),
    ("Sprint", "format", "A short Saturday race introduced in 2021, currently run at six events, with its own qualifying session since 2024."),
    ("Stewards", "governance", "The panel of four officials, including one former driver, who rule on incidents and apply penalties at each event."),
    ("Superlicence", "governance", "The FIA licence required to race in F1, earned through a points system across junior categories. Introduced in its current form in 2016."),
    ("Slipstream", "aerodynamics", "The low-drag region behind a car, used to gain speed before an overtake."),
    ("Tow", "aerodynamics", "The British term for slipstream."),
    ("Track limits", "sporting", "The white lines defining the circuit; a lap is deleted if all four wheels go beyond them."),
    ("Undercut", "strategy", "Pitting before a rival and using fresh-tyre pace to emerge ahead when they stop."),
    ("Overcut", "strategy", "Staying out longer than a rival, using clear air to build a gap before stopping."),
    ("Virtual Safety Car", "safety", "A field-wide delta-time speed restriction introduced in 2015, allowing yellow-flag conditions without bunching the field."),
    ("Wind tunnel restriction", "governance", "Aerodynamic testing time allocated in inverse proportion to championship position, to compress the competitive order."),
]

# year, event, detail, significance
GOVERNANCE = [
    (1946, "FIA constituted in its modern form", "The Federation Internationale de l'Automobile reorganised after the war and created the Commission Sportive Internationale.", "The sport's governing body."),
    (1950, "World Championship of Drivers created", "Seven races, six European Grands Prix plus the Indianapolis 500.", "The founding act."),
    (1958, "Constructors' Championship created", "First awarded to Vanwall.", "Made teams championship competitors in their own right."),
    (1970, "Bernie Ecclestone buys Brabham", "Ecclestone entered team ownership and soon led the Formula One Constructors' Association.", "The origin of the sport's centralised commercial model."),
    (1978, "FOCA vs FISA conflict begins", "A dispute between the British 'garagiste' teams and the governing body over technical rules and commercial rights.", "Nearly split the sport; several races were boycotted."),
    (1981, "First Concorde Agreement", "Settled rule-making authority with the FIA and commercial rights administration with FOCA.", "The framework that still governs the sport."),
    (1993, "Max Mosley elected FIA President", "Began a sustained programme on safety and cost control.", "Presided over the post-1994 safety transformation."),
    (1994, "FIA safety programme accelerated", "Following Imola, a permanent research and crash-testing programme was established.", "Underpins every subsequent safety rule."),
    (2000, "Commercial rights leased for 100 years", "The FIA leased the commercial rights to Ecclestone's companies from 2011 for a century.", "Separated governance from commerce definitively."),
    (2009, "FOTA breakaway threat", "Teams threatened to form a rival series over budget caps and governance.", "Resolved with Mosley's departure and a new Concorde Agreement."),
    (2009, "Jean Todt elected FIA President", "Former Ferrari team principal.", "Oversaw the hybrid formula and the cost cap's design."),
    (2017, "Liberty Media acquires Formula One", "Purchase from CVC Capital Partners completed in January 2017.", "Shifted the commercial strategy towards digital, US expansion and fan engagement; 'Drive to Survive' followed in 2019."),
    (2021, "Cost cap comes into force", "$145 m initially, tapering, with an FIA financial regulations division to audit teams.", "The most significant structural change to competition since the Concorde Agreement. Red Bull was found in minor breach for 2021 and penalised with a fine and reduced aerodynamic testing."),
    (2021, "Mohammed Ben Sulayem elected FIA President", "", ""),
    (2022, "Race control restructured", "Following the 2021 Abu Dhabi finish, the race director role was changed, a virtual race control room established and direct team-to-race-director radio removed.", "An institutional response to a refereeing failure."),
    (2023, "Andretti-Cadillac entry application", "The FIA approved the sporting application; the commercial rights holder initially declined.", "Exposed the tension between FIA approval and commercial acceptance of new entrants."),
    (2025, "Cadillac entry confirmed for 2026", "General Motors committed as a power-unit manufacturer and the entry was accepted.", "The grid expands to eleven teams for the first time since 2016."),
    (2026, "New regulations cycle begins", "Sections A-F of the F1 regulations reissued through 2025-26 for the new chassis, power unit, financial and operational rules.", "Audi and Cadillac join; Ford returns via Red Bull Powertrains."),
]
