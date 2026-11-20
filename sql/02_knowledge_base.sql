-- Base documentaire, brouillons et citations

create table if not exists knowledge_documents (
  id           bigserial primary key,
  org_id       bigint      not null default 1,
  titre        text        not null,
  version      int         not null default 1,
  etat         text        not null default 'brouillon'
               check (etat in ('brouillon', 'publie', 'retire')),
  proprietaire text,
  cree_le      timestamptz not null default now()
);

create table if not exists knowledge_chunks (
  id          bigserial primary key,
  org_id      bigint not null default 1,
  document_id bigint not null references knowledge_documents(id) on delete cascade,
  rang        int    not null,
  texte       text   not null,
  recherche   tsvector generated always as (to_tsvector('french', texte)) stored,
  unique (document_id, rang)
);

create index if not exists idx_chunks_fts on knowledge_chunks using gin (recherche);

create table if not exists drafts (
  id        bigserial primary key,
  org_id    bigint      not null default 1,
  ticket_id bigint      not null references tickets(id) on delete cascade,
  texte     text        not null,
  etaye     boolean     not null default false,
  statut    text        not null default 'a_valider'
            check (statut in ('a_valider', 'approuve', 'rejete', 'envoye')),
  modele    text,
  cree_le   timestamptz not null default now()
);

create table if not exists citations (
  id       bigserial primary key,
  draft_id bigint not null references drafts(id) on delete cascade,
  chunk_id bigint not null references knowledge_chunks(id),
  rang     int    not null
);

-- Corpus de depart (rejouable sans creer de doublons)

insert into knowledge_documents (titre, etat, proprietaire)
select v.titre, v.etat, v.proprietaire
from (values
  ('Reinitialiser son mot de passe', 'publie', 'support'),
  ('Compte bloque apres plusieurs tentatives', 'publie', 'support'),
  ('Double prelevement et remboursement', 'publie', 'facturation'),
  ('Lenteurs et incidents de service', 'publie', 'technique'),
  ('Tarifs et offres associations', 'publie', 'commercial')
) as v(titre, etat, proprietaire)
where not exists (select 1 from knowledge_documents k where k.titre = v.titre);

insert into knowledge_chunks (document_id, rang, texte)
select d.id, v.rang, v.texte
from (values
  ('Reinitialiser son mot de passe', 1, $t$Pour reinitialiser votre mot de passe, cliquez sur "Mot de passe oublie" depuis la page de connexion et saisissez l'adresse email de votre compte. Un lien de reinitialisation vous est envoye sous cinq minutes. Ce lien reste valable une heure.$t$),
  ('Reinitialiser son mot de passe', 2, $t$Si vous ne recevez pas le message, verifiez votre dossier indesirables. L'erreur "identifiants incorrects" peut aussi venir d'une majuscule involontaire ou d'un espace colle au mot de passe lors d'un copier-coller.$t$),
  ('Compte bloque apres plusieurs tentatives', 1, $t$Apres cinq tentatives de connexion infructueuses, l'acces au compte est suspendu pendant trente minutes. Le deblocage est automatique a l'issue de ce delai, aucune action n'est necessaire de votre part.$t$),
  ('Compte bloque apres plusieurs tentatives', 2, $t$Si le blocage persiste au-dela d'une heure, ou si vous recevez une alerte de connexion depuis un appareil inconnu, contactez le support : nous verifierons l'activite recente et debloquerons l'acces manuellement.$t$),
  ('Double prelevement et remboursement', 1, $t$En cas de double prelevement sur un meme abonnement, le montant en trop est rembourse sur le moyen de paiement d'origine. Le delai constate est de cinq a dix jours ouvres selon votre banque.$t$),
  ('Double prelevement et remboursement', 2, $t$Transmettez-nous la date du debit et les quatre derniers chiffres de la carte utilisee. Aucun justificatif supplementaire n'est demande. Les factures restent telechargeables depuis votre espace client, rubrique Facturation.$t$),
  ('Lenteurs et incidents de service', 1, $t$Les incidents en cours et les ralentissements connus sont publies sur notre page de statut, mise a jour toutes les quinze minutes. Consultez-la avant de signaler un probleme de lenteur.$t$),
  ('Lenteurs et incidents de service', 2, $t$Si aucun incident n'est signale et que les pages mettent plus de dix secondes a charger, indiquez-nous votre navigateur, votre ville et l'heure approximative du ralentissement.$t$),
  ('Tarifs et offres associations', 1, $t$Les associations declarees beneficient d'une remise de trente pour cent sur l'abonnement annuel, a partir de cinq utilisateurs. La remise s'applique des la premiere facture.$t$),
  ('Tarifs et offres associations', 2, $t$Pour en beneficier, envoyez le numero d'enregistrement de votre association. Un devis nominatif vous est retourne sous deux jours ouvres. Aucun engagement de duree n'est exige.$t$)
) as v(titre, rang, texte)
join knowledge_documents d on d.titre = v.titre
on conflict (document_id, rang) do nothing;
