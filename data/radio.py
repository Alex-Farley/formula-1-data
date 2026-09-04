# -*- coding: utf-8 -*-
"""
Notable team radio.

Formula 1 publishes team radio as AUDIO, from 2018 only, and produces no
transcripts. tools/fastf1_load.py indexes those clips and can transcribe them
with a local Whisper model. Everything in THIS file is different: a small
curated set of exchanges significant enough that the wording itself is part
of the sport's record, each one transcribed from broadcast and checked
against a written source before it was entered here.

The set is deliberately small. An exchange belongs here only if the exact
words are documented in a source that can be cited - not remembered. Several
famous ones are missing for exactly that reason.

Tuple order:
  year, round, driver_id (or None), speaker, channel, transcript, context,
  confidence, source
"""

WIKI = "https://en.wikipedia.org/wiki/"

NOTABLE_RADIO = [
    (2010, 11, "massa", "Rob Smedley (race engineer) to Felipe Massa",
     "pit-to-car",
     "OK, so, Fernando is faster than you. Can you confirm you understood "
     "that message?",
     "Lap 48 at Hockenheim. Team orders were banned outright at the time. "
     "Massa slowed at Turn 6 on the next lap and let Alonso through to win. "
     "Ferrari were fined $100,000 and the result stood; the FIA gave up and "
     "repealed the ban on team orders for 2011.",
     "high", WIKI + "2010_German_Grand_Prix"),

    (2013, 2, "vettel", "Christian Horner (team principal) to Sebastian Vettel",
     "pit-to-car",
     "This is silly, Seb. Come on.",
     "Lap 45 at Sepang. Red Bull had called 'Multi-Map 21' - a coded "
     "instruction for both drivers to turn the engines down and hold "
     "position, Webber first and Vettel second. Vettel passed him anyway and "
     "won. Webber's reply in the cool-down room afterwards, 'Multi 21, Seb. "
     "Yeah, Multi 21', is the line the incident is remembered by, but it was "
     "said face to face rather than over the radio.",
     "high", WIKI + "2013_Malaysian_Grand_Prix"),

    (2015, 14, "alonso", "Fernando Alonso to McLaren", "car-to-pit",
     "GP2 engine, GP2!",
     "Lap 27 at Suzuka, as Verstappen went past him on the straight. Alonso "
     "had left Ferrari for a McLaren-Honda that was down something like 150 "
     "bhp on the Mercedes; GP2 was the Formula One feeder series. Broadcast "
     "live, and it is the line that defined McLaren's Honda era.",
     "high", WIKI + "2015_Japanese_Grand_Prix"),

    (2021, 22, None, "Christian Horner (Red Bull) to race director Michael Masi",
     "team to race director",
     "these lapped cars out of the way",
     "The closing laps at Yas Marina, with the title live and a safety car "
     "out. Masi allowed only the cars between Hamilton and Verstappen to "
     "un-lap themselves, contrary to the usual procedure, and restarted for "
     "a single racing lap. Verstappen, on fresh tyres, passed Hamilton and "
     "took the championship.",
     "high", WIKI + "2021_Abu_Dhabi_Grand_Prix"),

    (2021, 22, None, "Toto Wolff (Mercedes) to race director Michael Masi",
     "team to race director",
     "Michael, this isn't right!",
     "Wolff's protest on the same channel moments later. Masi's reply - "
     "'Toto, it's called a motor race, ok? We went car racing.' - was "
     "broadcast with it. Mercedes protested, lost, and did not appeal; the "
     "FIA's own review found the restart procedure had been misapplied, and "
     "Masi was removed from the role for 2022.",
     "high", WIKI + "2021_Abu_Dhabi_Grand_Prix"),

    (2021, 22, None, "Michael Masi (race director) to Toto Wolff",
     "race director to team",
     "Toto, it's called a motor race, ok? We went car racing.",
     "The reply to Wolff, broadcast live on the world feed as the race ended.",
     "high", WIKI + "2021_Abu_Dhabi_Grand_Prix"),
]
