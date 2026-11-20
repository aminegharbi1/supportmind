create table if not exists customers (
  id          bigserial primary key,
  org_id      bigint      not null default 1,
  email       text        not null,
  nom         text,
  langue      text        default 'fr',
  cree_le     timestamptz not null default now(),
  unique (org_id, email)
);

create table if not exists tickets (
  id           bigserial primary key,
  org_id       bigint      not null default 1,
  customer_id  bigint      not null references customers(id),
  sujet        text        not null,
  statut       text        not null default 'nouveau',
  categorie    text,
  priorite     text,
  confiance    numeric(4,3),
  canal        text        not null default 'email',
  assigne_a    text,
  sla_echeance timestamptz,
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now()
);

create table if not exists messages (
  id          bigserial primary key,
  org_id      bigint      not null default 1,
  ticket_id   bigint      not null references tickets(id) on delete cascade,
  provider_id text        not null,
  sens        text        not null check (sens in ('entrant', 'sortant')),
  expediteur  text,
  texte       text,
  recu_le     timestamptz not null default now(),
  unique (org_id, provider_id)
);

create index if not exists idx_tickets_statut   on tickets (org_id, statut);
create index if not exists idx_messages_ticket  on messages (ticket_id, recu_le);

create table if not exists escalations (
  id         bigserial primary key,
  org_id     bigint      not null default 1,
  ticket_id  bigint      not null references tickets(id) on delete cascade,
  file_cible text        not null default 'n2',
  motif      text        not null,
  statut     text        not null default 'ouverte'
             check (statut in ('ouverte', 'prise_en_charge', 'resolue')),
  cree_le    timestamptz not null default now()
);
