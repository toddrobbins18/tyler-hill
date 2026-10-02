-- Verify Nest 2027 grades vs Todd CampMinder export (365 campers, 2026-10-02)
-- Read-only. Run anytime after fix or sync to confirm grades match.

CREATE TEMP TABLE todd_cm_grades (
  person_id text PRIMARY KEY,
  last_name text,
  first_name text,
  camp_grade text
) ON COMMIT DROP;

INSERT INTO todd_cm_grades (person_id, last_name, first_name, camp_grade) VALUES
  ('8412151', 'Palumbo', 'William', '8th'),
  ('9714577', 'Wurst', 'Sydney', '8th'),
  ('10123947', 'Pedicini', 'Quinn', '6th'),
  ('10784657', 'Zachary', 'Aria', '7th'),
  ('10786194', 'Zachary', 'Chayse', '7th'),
  ('11106771', 'Camus', 'Vivian', '5th'),
  ('11144608', 'Fisher', 'Juliette', '7th'),
  ('11160506', 'DiFruscio', 'Christiana', '7th'),
  ('12316513', 'Drimmer', 'Jackson', '7th'),
  ('12444438', 'Pedicini', 'Tate', '4th'),
  ('12719731', 'Trager', 'Maxie', '6th'),
  ('13312484', 'Robbins', 'Cali', '3rd'),
  ('13338717', 'Miller', 'Kate', '6th'),
  ('13355944', 'Pedicini', 'Luca', '7th'),
  ('13356290', 'Schembri', 'Mason', '5th'),
  ('13357068', 'Goldstein', 'Sienna', '7th'),
  ('13505073', 'Fine', 'Gavin', '3rd'),
  ('13719617', 'Klein', 'Brielle', '5th'),
  ('13750806', 'Grella', 'Nathaniel', '4th'),
  ('13754307', 'Bendrihem', 'Blaire', '3rd'),
  ('13789341', 'Meltzer', 'Rose', '4th'),
  ('13789804', 'Struck', 'Joshua', '6th'),
  ('13850040', 'Orlowsky', 'Nina', '7th'),
  ('13892454', 'Levy', 'Sasha', '4th'),
  ('13917078', 'Baez', 'Gabriella', '8th'),
  ('13917168', 'Baez', 'Jessica', '8th'),
  ('14302331', 'Kazmi', 'Kayhan', '8th'),
  ('14330034', 'Griffin-Katsorhis', 'Xander', '4th'),
  ('14594693', 'Bianchi', 'Isabel', '2nd'),
  ('14601880', 'Chertok', 'Boaz', '3rd'),
  ('14602177', 'Rubel', 'Alex', '8th'),
  ('14604653', 'Danesh', 'Omri', '3rd'),
  ('14665007', 'Miness', 'Graham', '2nd'),
  ('14851947', 'Koutsoyiannis Paula', 'Anais', '2nd'),
  ('14964644', 'Haynes', 'Carter', '3rd'),
  ('15032785', 'Peltz', 'Benjamin', '3rd'),
  ('15056132', 'Omara', 'Braxton', '4th'),
  ('15134493', 'Siegel', 'Liev', '6th'),
  ('15136114', 'Schwartz', 'Graham', '2nd'),
  ('15261841', 'Trautmann', 'Boden', '7th'),
  ('15289058', 'Mancuso', 'Hailey', '2nd'),
  ('15311237', 'Flores', 'Caroline', '5th'),
  ('15313421', 'Caliendo', 'Alex', '6th'),
  ('15313451', 'Caliendo', 'Luca', '6th'),
  ('15349137', 'Saper', 'Sylvie', '4th'),
  ('15415423', 'Baumgarten', 'Frank', '7th'),
  ('15439067', 'Yung', 'Madison', '8th'),
  ('15516686', 'Orlowsky', 'Gisela', '4th'),
  ('15603813', 'Hadden', 'Shane', '3rd'),
  ('15624985', 'Scaccia', 'Nicholas', '3rd'),
  ('15790852', 'Siegel', 'Miles', '2nd'),
  ('15886920', 'Chalson', 'Jackson', '7th'),
  ('15899187', 'Robbins', 'Andi', '1st'),
  ('15930853', 'Grella', 'Lucas', '2nd'),
  ('15942859', 'Chalson', 'Nina', '5th'),
  ('15964365', 'Poon', 'Addison', '6th'),
  ('15964380', 'Poon', 'Leighton', '3rd'),
  ('15964703', 'Dean', 'Jonah', '4th'),
  ('15964755', 'Kraft', 'Levi', '2nd'),
  ('15964915', 'Goodman', 'Molly', '1st'),
  ('15964943', 'Sabatino', 'Adelina', '6th'),
  ('15965006', 'Zamer', 'Maisie', '5th'),
  ('15965236', 'Weinberg', 'Millie', '1st'),
  ('15965489', 'Goldberg', 'Harris', '3rd'),
  ('15965499', 'Mandel', 'Lucas', '3rd'),
  ('15965524', 'Wissner-Goldman', 'Julian', '5th'),
  ('15965688', 'Ross', 'Simon', '3rd'),
  ('15966983', 'Loman', 'Remi', '2nd'),
  ('15968674', 'Levine', 'Dylan', '2nd'),
  ('15970453', 'Mann', 'Jack', '3rd'),
  ('15972476', 'Schwartz', 'Eitan', '3rd'),
  ('16277802', 'Slavuter', 'Ava', '6th'),
  ('16280060', 'Slavuter', 'Lilah', '4th'),
  ('16406047', 'Gold', 'Molly', '2nd'),
  ('16408974', 'Fishman', 'Mason', '7th'),
  ('16412400', 'Baumgarten', 'Rose', '4th'),
  ('16421701', 'Haynes', 'Alina', '1st'),
  ('16423246', 'Simon', 'Charlotte', '4th'),
  ('16423617', 'Schembri', 'Austen', '3rd'),
  ('16424020', 'Chalmers', 'Jacob', '3rd'),
  ('16424936', 'Lichtenstein', 'Grant', '4th'),
  ('16440436', 'Yadegar', 'Lev', '2nd'),
  ('16459835', 'Cohan', 'Ethan', '2nd'),
  ('16486738', 'Alyesh', 'Sophie', '1st'),
  ('16500167', 'Tawil', 'Sloan', '1st'),
  ('16508258', 'Corn', 'Isabella', '1st'),
  ('16517148', 'Kazmi', 'Aayhan', '1st'),
  ('16529579', 'Trahanas', 'Georgia', '2nd'),
  ('16729521', 'Capland', 'Max', '3rd'),
  ('16801626', 'Chan', 'Aurelia', '2nd'),
  ('17032919', 'Detore', 'Jake', '2nd'),
  ('17032930', 'Detore', 'Adam', '2nd'),
  ('17151165', 'Sterling', 'Elijah', '3rd'),
  ('17151191', 'Sterling', 'Charlotte', '2nd'),
  ('17210585', 'Cooperman', 'Lance', '2nd'),
  ('17260533', 'Lytle', 'Henry', '2nd'),
  ('17263456', 'Rogel', 'Toby', '3rd'),
  ('17281625', 'Wunsch', 'Emma', '3rd'),
  ('17309057', 'Scimone', 'Anthony', '5th'),
  ('17639258', 'Wiktor', 'Logan', '2nd'),
  ('17761099', 'Siegel', 'Rory', '1st'),
  ('17764044', 'Widom', 'Akiva', '1st'),
  ('17765848', 'Wissner-Goldman', 'Caleb', '2nd'),
  ('17767118', 'Griffin - Katsorhis', 'Kiki', '2nd'),
  ('17771057', 'Frankel', 'Leah', '3rd'),
  ('17773525', 'Weinreb', 'Meir', '1st'),
  ('17775724', 'Rogel', 'Lily', '1st'),
  ('17776587', 'Levitt', 'Pia', '1st'),
  ('17777460', 'Zuckerman', 'Drew', '1st'),
  ('17796924', 'Kehrer', 'Caroline', '3rd'),
  ('17796936', 'Kehrer', 'Jack', '1st'),
  ('17803797', 'Smolin', 'Noah', '2nd'),
  ('17804554', 'Sendach', 'Mia', '1st'),
  ('17804676', 'Friedmann', 'Ezra', '3rd'),
  ('17805509', 'Ross', 'Gabriel', '1st'),
  ('17814923', 'Gorin', 'Alexander', '2nd'),
  ('17816127', 'Niss', 'Charlie', '2nd'),
  ('17820391', 'Reyes', 'Jayden', '4th'),
  ('17827102', 'Horowitz', 'Ford', '2nd'),
  ('17828826', 'Kusinitz', 'Josie', '1st'),
  ('17829055', 'Van Manen', 'Emma', '1st'),
  ('17854163', 'Bendrihem', 'Bradley', '1st'),
  ('17854314', 'Hartman', 'Noah', '1st'),
  ('17856471', 'Groman', 'Riley', '2nd'),
  ('17857942', 'Goldman', 'Derek', '1st'),
  ('17859042', 'Pacheco', 'Penelope', '1st'),
  ('17864597', 'Stearn', 'Logan', '1st'),
  ('17864799', 'Vairavamurthy', 'Nivya', '5th'),
  ('17864805', 'Sarraf', 'Milan', '2nd'),
  ('17864839', 'Gohari', 'Jonah', '2nd'),
  ('17866105', 'Mandel', 'Logan', '1st'),
  ('17866111', 'Smolinsky', 'Magnolia', '2nd'),
  ('17867434', 'Lombardo', 'Ryan', '3rd'),
  ('17868973', 'Kottler', 'Jordan', '2nd'),
  ('17914859', 'Frost', 'Vera', '3rd'),
  ('17930159', 'Eldred', 'Tess', '1st'),
  ('17954687', 'Alyesh', 'Isabel', 'K'),
  ('18001163', 'Seldon', 'Whitney', '1st'),
  ('18059686', 'Reichenbacher', 'Indy', '2nd'),
  ('18150955', 'Wallack', 'Jordyn', '2nd'),
  ('18241821', 'McAloon', 'James', '5th'),
  ('18279867', 'Carboy', 'Benjamin', '2nd'),
  ('18337223', 'Schlesinger', 'Ava', '2nd'),
  ('18337238', 'Schlesinger', 'Jack', 'K'),
  ('18361796', 'Streeter', 'Elliot', '4th'),
  ('18439300', 'Partovich', 'Harlow', '1st'),
  ('18661536', 'Escoto', 'Gema', '3rd'),
  ('18786240', 'O''Malley', 'Delaney', '3rd'),
  ('18793646', 'Silberzweig', 'Jaxsen', '3rd'),
  ('18932068', 'Singer', 'Shea', '2nd'),
  ('18951475', 'Wolpert', 'Haley', '2nd'),
  ('18989436', 'Berman', 'Harrison', '1st'),
  ('19007650', 'Choi', 'Nora', '1st'),
  ('19026598', 'Henneman', 'Anisa', '1st'),
  ('19028566', 'Nicholson', 'Ariella', '2nd'),
  ('19037145', 'Golub', 'Samantha', '2nd'),
  ('19040004', 'Chertok', 'Gefen', 'K'),
  ('19040085', 'Schwartz', 'Autumn', 'K'),
  ('19041893', 'Detore', 'Kaia', 'K'),
  ('19047998', 'Mann', 'Alex', 'Pre-K'),
  ('19051852', 'Kazmi', 'Orhan', 'Pre-K'),
  ('19096250', 'Zuckerman', 'Casey', 'K'),
  ('19113453', 'Mayrsohn', 'Ava', '3rd'),
  ('19116452', 'Goldenberg', 'Sydney', '1st'),
  ('19117141', 'Kilcullen', 'Hallie', 'K'),
  ('19128674', 'Steffen', 'Mila', '1st'),
  ('19130276', 'Vuernick', 'Luke', '1st'),
  ('19133691', 'Danesh', 'Misha', '1st'),
  ('19134778', 'Meltzer', 'Jett', 'K'),
  ('19135291', 'Kravel', 'Dylan', 'K'),
  ('19135527', 'Lovens', 'Noa', '1st'),
  ('19138706', 'Sirotkin', 'Josie', '1st'),
  ('19138712', 'Korngold', 'Oliver', '1st'),
  ('19140103', 'Widom', 'Roey', 'K'),
  ('19153728', 'Loman', 'Isabelle', 'K'),
  ('19158903', 'Stumacher', 'Sylvie', 'K'),
  ('19161611', 'Cooper', 'Delilah', 'K'),
  ('19167839', 'Trahanas', 'James', 'K'),
  ('19170614', 'Levine', 'Madison', 'K'),
  ('19170801', 'Rodzianko', 'Sebastian', '7th'),
  ('19170806', 'Rodzianko', 'Sabrina', '3rd'),
  ('19171289', 'Stegman', 'Jordy', '1st'),
  ('19171641', 'Brennan', 'Dylan', 'K'),
  ('19172231', 'Group', 'Sage', 'K'),
  ('19172525', 'Simon', 'Alexandra', '2nd'),
  ('19172621', 'Mald', 'Lily', 'K'),
  ('19172684', 'Marin', 'Colin', '2nd'),
  ('19172697', 'Hanik', 'Hunter', 'K'),
  ('19172790', 'Barzideh', 'Naomi', '2nd'),
  ('19172809', 'Barzideh', 'Mikayla', 'K'),
  ('19172849', 'Sabatino', 'Aidan', '3rd'),
  ('19173202', 'Grauman', 'Noa', 'K'),
  ('19173229', 'Siegel', 'Lillian', '2nd'),
  ('19173458', 'Davoudian', 'Louis', '3rd'),
  ('19173655', 'Seldon', 'Mark', 'Pre-K'),
  ('19173957', 'Wein', 'Hudson', '1st'),
  ('19174210', 'Hirschberger', 'Hannah', '1st'),
  ('19176159', 'Mayrsohn', 'Lila', 'K'),
  ('19176565', 'Weinreb', 'Ajax', 'Pre-K'),
  ('19216512', 'Tawil', 'Mac', 'Pre-K'),
  ('19219558', 'Gordon', 'Jake', 'K'),
  ('19253584', 'Rolnik', 'Harrison', 'Pre-K'),
  ('19270421', 'Sardelli', 'Aidan', '3rd'),
  ('19275433', 'OToole', 'Olivia', '5th'),
  ('19279825', 'DeBellis', 'Levi', '1st'),
  ('19287508', 'Meile', 'August', 'K'),
  ('19356234', 'Kaplon', 'Gabrielle', '4th'),
  ('19493746', 'Weiser', 'Zachary', '7th'),
  ('19608513', 'Azarnejad', 'Cameron', '2nd'),
  ('19653114', 'Mercado', 'Cole', 'K'),
  ('19683933', 'Aguero Rios', 'Emma', '1st'),
  ('19740919', 'Delmoro', 'Landon', '2nd'),
  ('19751744', 'Weissman', 'Thea', '2nd'),
  ('19751745', 'Weissman', 'Sophie', '2nd'),
  ('19757047', 'Levy', 'Jacob', 'Pre-K'),
  ('19782757', 'Lytle', 'Cole', 'K'),
  ('19804136', 'Sachs', 'Joanna', '4th'),
  ('19804173', 'Sachs', 'Bayla', '7th'),
  ('19805983', 'Ablamsky', 'Austin', '2nd'),
  ('19834872', 'Cooperman', 'Ava', '1st'),
  ('19846824', 'Maslin', 'Juliet', 'K'),
  ('20016156', 'Duffy', 'Logan', '2nd'),
  ('20017161', 'Duffy', 'Scarlett', 'K'),
  ('20057806', 'Chiou', 'Reve', '1st'),
  ('20082074', 'Sciama', 'Luca', 'Pre-K'),
  ('20105713', 'Lichtenstein', 'Simon', 'K'),
  ('20127301', 'Labbate', 'Gianna', 'Pre-K'),
  ('20209208', 'Greene', 'Ava', 'K'),
  ('20240357', 'Goldstein', 'Rikki', 'K'),
  ('20326611', 'Langendorff', 'Gabriel', '1st'),
  ('20326612', 'Langendorff', 'Ryan', 'Pre-K'),
  ('20353882', 'Frey', 'Michael', '4th'),
  ('20354352', 'Friedmann', 'Sylvie', '1st'),
  ('20354553', 'Bernacchio', 'Braden', '3rd'),
  ('20355725', 'Smolinsky', 'Hannah', 'K'),
  ('20355942', 'Manoff', 'Cooper', 'K'),
  ('20356696', 'Toscano', 'Mila', '1st'),
  ('20360422', 'Dean', 'Olivia', '1st'),
  ('20365824', 'Kuzon', 'Miles', 'K'),
  ('20365942', 'Goodman', 'Ari', 'Pre-K'),
  ('20378658', 'Sparks Fonacier', 'Silas', '2nd'),
  ('20379664', 'Kaplon', 'Vivian', '1st'),
  ('20384225', 'Marshall', 'Claire', '2nd'),
  ('20384226', 'Marshall', 'Spencer', 'K'),
  ('20402603', 'Savarese', 'Reagan', '1st'),
  ('20403742', 'Chalmers', 'Reid', 'K'),
  ('20405661', 'Saper', 'Jackson', '8th'),
  ('20412962', 'Horowitz', 'Gigi', 'Pre-K'),
  ('20423495', 'Kreitman', 'Hayden', '2nd'),
  ('20438868', 'Wallack', 'Cade', 'K'),
  ('20439819', 'Lovens', 'Jack', 'K'),
  ('20440845', 'Stegman', 'Leni', 'Pre-K'),
  ('20443438', 'Sarraf', 'Jaden', 'K'),
  ('20443504', 'Cohan', 'Asher', 'K'),
  ('20443569', 'Witthuhn', 'Alina', 'Pre-K'),
  ('20445712', 'Reichenbacher', 'Demi', 'K'),
  ('20448437', 'Frey', 'John', '3rd'),
  ('20448453', 'Frey', 'Matthew', '1st'),
  ('20448475', 'Singer', 'Liv', 'Pre-K'),
  ('20448538', 'Rocco', 'Sophia', 'K'),
  ('20448695', 'Omara', 'Brienna', 'K'),
  ('20448890', 'Shepard', 'Mary', '2nd'),
  ('20448894', 'Shepard', 'Blake', 'K'),
  ('20449505', 'Barash', 'Harper', 'K'),
  ('20450465', 'Stearn', 'Ella', 'Pre-K'),
  ('20458100', 'Mandel', 'Olivia', '2nd'),
  ('20466741', 'Caviris', 'Billie', '1st'),
  ('20471417', 'Yadegar', 'Ben', 'K'),
  ('20496401', 'Yeshoua', 'Simone', '1st'),
  ('20503395', 'van den Bergh', 'Daniella', '2nd'),
  ('20503403', 'van den Bergh', 'Jacob', 'K'),
  ('20517239', 'Lytle', 'Evan', 'Pre-K'),
  ('20517495', 'Schreier', 'Scarlett', 'Pre-K'),
  ('20535727', 'Carmel', 'Noa', '1st'),
  ('20545195', 'Flores', 'Amelia', '2nd'),
  ('20634174', 'Hiller', 'Cora', '1st'),
  ('20640496', 'Greenfield', 'Sydney', '1st'),
  ('20667482', 'Cannon', 'Ryan', '6th'),
  ('20826985', 'Hushmendy', 'Zariah', 'Pre-K'),
  ('20892001', 'Beere', 'Elliott', '1st'),
  ('20892272', 'Mastronardi', 'Marcella', '2nd'),
  ('20914156', 'Tortorici', 'Lucia', 'Pre-K'),
  ('21004934', 'Anteby', 'Audrey', 'Pre-K'),
  ('21005862', 'Bagnato', 'Liana', 'K'),
  ('21156573', 'Noor', 'Adam', 'Pre-K'),
  ('21209660', 'Arena', 'Josie', '2nd'),
  ('21220047', 'Greengrass', 'Tyler', '3rd'),
  ('21232171', 'Morrison', 'Brayden', 'K'),
  ('21248979', 'Weissler', 'Layla', '1st'),
  ('21281796', 'Alter', 'Charlotte', '7th'),
  ('21310846', 'OToole', 'Rocco', '2nd'),
  ('21329100', 'Seldon', 'Kylie', 'Nursery'),
  ('21329158', 'McCloy', 'Ryan', '4th'),
  ('21363509', 'Dwyer', 'Juliette', '1st'),
  ('21363536', 'Dwyer', 'Jack', 'Pre-K'),
  ('21374121', 'Severino', 'Lennox', '1st'),
  ('21386332', 'Chimonitis', 'Parker', '4th'),
  ('21388506', 'Dean', 'Michael', 'Pre-K'),
  ('21441679', 'Bornstein', 'Lev', 'K'),
  ('21464875', 'Geffen', 'Ethan', '1st'),
  ('21608496', 'Suckiel', 'Caellum', 'K'),
  ('21618000', 'DeRose', 'Lorenzo', 'K'),
  ('21639331', 'Strachman', 'Corey', 'K'),
  ('21805524', 'Kittai', 'Yael', '1st'),
  ('21901730', 'Kazmi', 'Zayhan', 'Nursery'),
  ('21901737', 'Salzer', 'Daisy', 'Pre-K'),
  ('21912603', 'Levine', 'Hunter', '1st'),
  ('21917378', 'DelMoro', 'Drew', 'Pre-K'),
  ('21919275', 'Kelly', 'Hailey', '1st'),
  ('21919276', 'Kelly', 'Riley', '3rd'),
  ('21928515', 'Scoparino', 'Ellie', '2nd'),
  ('21931541', 'Makowski', 'Kayla', 'Pre-K'),
  ('21941074', 'Wiesenfeld', 'Ava', 'K'),
  ('21941506', 'Cooper', 'Mia', 'Pre-K'),
  ('21944768', 'Figliolia', 'Sienna', '1st'),
  ('21946851', 'Azarnejad', 'Lena', 'K'),
  ('21955027', 'Rubin', 'Evan', '1st'),
  ('21955574', 'Wiktor', 'Blake', 'Pre-K'),
  ('21965529', 'Coltrinari', 'Derek', 'Pre-K'),
  ('21970714', 'Kravitz', 'Elinor', '1st'),
  ('21970730', 'Kravitz', 'Leo', 'Nursery'),
  ('21972836', 'Swirsky', 'Benjamin', 'K'),
  ('21980906', 'Schlesinger', 'Ozzie', 'Nursery'),
  ('21984077', 'O''Malley', 'August', 'Pre-K'),
  ('21985770', 'Menna', 'Michael', '2nd'),
  ('21985787', 'Menna', 'Mason', '1st'),
  ('22007210', 'Kornhaber', 'Ryan', 'Pre-K'),
  ('22007700', 'Caviris', 'John', 'Pre-K'),
  ('22019455', 'Hefferon', 'Rosie', 'Pre-K'),
  ('22021620', 'Tursi', 'Chiara', '1st'),
  ('22023960', 'Forsberg', 'Christopher', '2nd'),
  ('22023966', 'Forsberg', 'Matthew', '1st'),
  ('22027162', 'Kittai', 'Levi', '3rd'),
  ('22027440', 'Byler', 'Natalie', '2nd'),
  ('22028066', 'Maxwell', 'Benjamin', 'Nursery'),
  ('22028347', 'Schwartz', 'Aviva', 'K'),
  ('22028495', 'Nemzer', 'Daniel', '3rd'),
  ('22028499', 'Nemzer', 'Rafaela', 'K'),
  ('22029324', 'Wall', 'Drew', 'K'),
  ('22029683', 'Rosengard', 'Leni', 'Pre-K'),
  ('22030631', 'Sirotkin', 'Harrison', 'Pre-K'),
  ('22032075', 'Fox', 'Benjamin', 'Pre-K'),
  ('22032198', 'Bruno', 'Jacob', 'K'),
  ('22032380', 'Goldstein', 'Sadie', 'Pre-K'),
  ('22032398', 'Goldstein', 'Ari', 'Nursery'),
  ('22034344', 'Petrossian', 'Theo', '1st'),
  ('22035170', 'Petrossian', 'Andre', 'Pre-K'),
  ('22037065', 'Benjamin', 'Graham', '4th'),
  ('22037217', 'Davoudian', 'Max', 'Pre-K'),
  ('22039906', 'Kottler', 'Alex', 'Pre-K'),
  ('22039925', 'Nadel', 'Esme', 'K'),
  ('22040843', 'Isakov', 'Amelia', '2nd'),
  ('22041498', 'DeBellis', 'Noah', 'Pre-K'),
  ('22041567', 'Capland', 'Evie', 'K'),
  ('22041571', 'Toscano', 'Sadie', 'Pre-K'),
  ('22041655', 'Knetzger', 'Alma', 'K'),
  ('22041716', 'Zamer', 'Graham', 'K'),
  ('22041775', 'Smolinsky', 'Summer', 'Pre-K'),
  ('22041776', 'Siegel', 'Spencer', 'K'),
  ('22042080', 'Jakaitis', 'Ruby', 'Pre-K'),
  ('22042658', 'Labbate', 'Gabriella', 'Nursery'),
  ('22045819', 'Juergens', 'Lillian', '1st'),
  ('22045838', 'Juergens', 'Evelyn', '1st'),
  ('22045874', 'Stewart', 'Hudson', 'Nursery'),
  ('22045888', 'Stewart', 'Madison', 'K');

CREATE OR REPLACE FUNCTION pg_temp.norm_grade(raw text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN raw IS NULL OR trim(raw) = '' THEN NULL
    WHEN lower(trim(raw)) IN ('k', 'kindergarten') THEN 'Kindergarten'
    WHEN lower(replace(replace(trim(raw), ' ', ''), '-', '')) = 'prek' THEN 'Pre - K'
    WHEN lower(trim(raw)) = 'pre-k' THEN 'Pre - K'
    WHEN lower(trim(raw)) = 'nursery' THEN 'Nursery'
    ELSE trim(raw)
  END;
$$;

-- =============================================================================
-- 1) SUMMARY
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM todd_cm_grades) AS campminder_export_count,
  (SELECT COUNT(*) FROM public.children ch
   JOIN public.companies co ON co.id = ch.company_id
   WHERE co.slug = 'north-shore-day-camp' AND ch.season = '2027'
     AND COALESCE(ch.status, 'active') <> 'inactive') AS nest_2027_active_count,
  (SELECT COUNT(*) FROM public.children ch
   JOIN public.companies co ON co.id = ch.company_id
   JOIN todd_cm_grades t ON t.person_id = ch.person_id
   WHERE co.slug = 'north-shore-day-camp' AND ch.season = '2027'
     AND COALESCE(ch.status, 'active') <> 'inactive') AS matched_on_person_id,
  (SELECT COUNT(*) FROM public.children ch
   JOIN public.companies co ON co.id = ch.company_id
   JOIN todd_cm_grades t ON t.person_id = ch.person_id
   WHERE co.slug = 'north-shore-day-camp' AND ch.season = '2027'
     AND COALESCE(ch.status, 'active') <> 'inactive'
     AND pg_temp.norm_grade(ch.grade) = pg_temp.norm_grade(t.camp_grade)) AS grades_match,
  (SELECT COUNT(*) FROM public.children ch
   JOIN public.companies co ON co.id = ch.company_id
   JOIN todd_cm_grades t ON t.person_id = ch.person_id
   WHERE co.slug = 'north-shore-day-camp' AND ch.season = '2027'
     AND COALESCE(ch.status, 'active') <> 'inactive'
     AND pg_temp.norm_grade(ch.grade) IS DISTINCT FROM pg_temp.norm_grade(t.camp_grade)) AS grade_mismatches,
  (SELECT COUNT(*) FROM todd_cm_grades t
   WHERE NOT EXISTS (
     SELECT 1 FROM public.children ch
     JOIN public.companies co ON co.id = ch.company_id
     WHERE co.slug = 'north-shore-day-camp' AND ch.season = '2027'
       AND ch.person_id = t.person_id)) AS in_campminder_not_nest,
  (SELECT COUNT(*) FROM public.children ch
   JOIN public.companies co ON co.id = ch.company_id
   WHERE co.slug = 'north-shore-day-camp' AND ch.season = '2027'
     AND COALESCE(ch.status, 'active') <> 'inactive'
     AND NOT EXISTS (SELECT 1 FROM todd_cm_grades t WHERE t.person_id = ch.person_id)) AS in_nest_not_campminder;

-- =============================================================================
-- 2) FULL COMPARISON (all matched campers)
-- =============================================================================
SELECT
  ch.person_id,
  ch.name AS nest_name,
  t.last_name || ', ' || t.first_name AS cm_name,
  pg_temp.norm_grade(ch.grade) AS nest_grade,
  pg_temp.norm_grade(t.camp_grade) AS campminder_grade,
  d.name AS nest_division,
  CASE
    WHEN pg_temp.norm_grade(ch.grade) = pg_temp.norm_grade(t.camp_grade) THEN 'OK'
    ELSE 'MISMATCH'
  END AS status
FROM public.children ch
JOIN public.companies co ON co.id = ch.company_id
JOIN todd_cm_grades t ON t.person_id = ch.person_id
LEFT JOIN public.divisions d ON d.id = ch.division_id
WHERE co.slug = 'north-shore-day-camp'
  AND ch.season = '2027'
  AND COALESCE(ch.status, 'active') <> 'inactive'
ORDER BY
  CASE WHEN pg_temp.norm_grade(ch.grade) IS DISTINCT FROM pg_temp.norm_grade(t.camp_grade) THEN 0 ELSE 1 END,
  ch.name;

-- =============================================================================
-- 3) MISMATCHES ONLY (should be empty after fix)
-- =============================================================================
SELECT
  ch.person_id,
  ch.name,
  pg_temp.norm_grade(ch.grade) AS nest_grade,
  pg_temp.norm_grade(t.camp_grade) AS campminder_grade
FROM public.children ch
JOIN public.companies co ON co.id = ch.company_id
JOIN todd_cm_grades t ON t.person_id = ch.person_id
WHERE co.slug = 'north-shore-day-camp'
  AND ch.season = '2027'
  AND COALESCE(ch.status, 'active') <> 'inactive'
  AND pg_temp.norm_grade(ch.grade) IS DISTINCT FROM pg_temp.norm_grade(t.camp_grade)
ORDER BY ch.name;

-- =============================================================================
-- 4) In CampMinder export but not in Nest 2027
-- =============================================================================
SELECT t.person_id, t.last_name, t.first_name, t.camp_grade AS campminder_grade
FROM todd_cm_grades t
WHERE NOT EXISTS (
  SELECT 1 FROM public.children ch
  JOIN public.companies co ON co.id = ch.company_id
  WHERE co.slug = 'north-shore-day-camp' AND ch.season = '2027'
    AND ch.person_id = t.person_id
)
ORDER BY t.last_name, t.first_name;

-- =============================================================================
-- 5) In Nest 2027 but not in CampMinder export
-- =============================================================================
SELECT ch.person_id, ch.name, ch.grade AS nest_grade
FROM public.children ch
JOIN public.companies co ON co.id = ch.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND ch.season = '2027'
  AND COALESCE(ch.status, 'active') <> 'inactive'
  AND NOT EXISTS (SELECT 1 FROM todd_cm_grades t WHERE t.person_id = ch.person_id)
ORDER BY ch.name;
