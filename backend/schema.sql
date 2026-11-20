--
-- PostgreSQL database dump
--

\restrict 3gsTJc2e577QowkqgyPYv8AlICGGR5FYXrQyPNexlz3tldNZo3HOA2lIjC5OdgM

-- Dumped from database version 17.12 (Debian 17.12-1.pgdg13+1)
-- Dumped by pg_dump version 17.12 (Debian 17.12-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: leave_accrual_run_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_accrual_run_details (
    id integer NOT NULL,
    run_id integer NOT NULL,
    user_id integer,
    user_name character varying(200) NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) NOT NULL,
    message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT leave_accrual_run_details_status_check CHECK (((status)::text = ANY ((ARRAY['credited'::character varying, 'duplicate'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: leave_accrual_run_details_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_accrual_run_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_accrual_run_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_accrual_run_details_id_seq OWNED BY public.leave_accrual_run_details.id;


--
-- Name: leave_accrual_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_accrual_runs (
    id integer NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at timestamp without time zone,
    period_year integer,
    period_month smallint,
    status character varying(20) NOT NULL,
    credits_count integer DEFAULT 0 NOT NULL,
    days_credited numeric(10,2) DEFAULT 0 NOT NULL,
    duplicates_ignored integer DEFAULT 0 NOT NULL,
    message text,
    CONSTRAINT leave_accrual_runs_status_check CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'ignored'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: leave_accrual_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_accrual_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_accrual_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_accrual_runs_id_seq OWNED BY public.leave_accrual_runs.id;


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_balances (
    id integer NOT NULL,
    user_id integer NOT NULL,
    year integer NOT NULL,
    acquired_days numeric(7,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_acquired_days CHECK ((acquired_days >= (0)::numeric))
);


--
-- Name: leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    leave_type character varying(30) DEFAULT 'paid_leave'::character varying NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    comment text,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cancellation_previous_status character varying(20),
    CONSTRAINT valid_dates CHECK ((end_date >= start_date)),
    CONSTRAINT valid_leave_type CHECK (((leave_type)::text = ANY ((ARRAY['paid_leave'::character varying, 'unpaid_leave'::character varying, 'sick_leave'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('cancelled'::character varying)::text, ('cancellation_requested'::character varying)::text])))
);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: leave_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_settings (
    id integer NOT NULL,
    monthly_accrual numeric(5,2) DEFAULT 2.5 NOT NULL,
    accrual_day integer DEFAULT 1 NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leave_settings_accrual_day_check CHECK (((accrual_day >= 1) AND (accrual_day <= 28))),
    CONSTRAINT leave_settings_id_check CHECK ((id = 1)),
    CONSTRAINT leave_settings_monthly_accrual_check CHECK ((monthly_accrual > (0)::numeric))
);


--
-- Name: leave_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    leave_request_id integer,
    created_by integer,
    year integer NOT NULL,
    amount numeric(7,2) NOT NULL,
    transaction_type character varying(30) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    period_month smallint,
    CONSTRAINT valid_period_month CHECK (((period_month IS NULL) OR ((period_month >= 1) AND (period_month <= 12)))),
    CONSTRAINT valid_transaction_type CHECK (((transaction_type)::text = ANY ((ARRAY['adjustment'::character varying, 'leave_taken'::character varying, 'reversal'::character varying, 'accrual'::character varying])::text[])))
);


--
-- Name: leave_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_transactions_id_seq OWNED BY public.leave_transactions.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    leave_request_id integer,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    manager_id integer
);


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20) DEFAULT 'employee'::character varying NOT NULL,
    team_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    hire_date date,
    CONSTRAINT valid_role CHECK (((role)::text = ANY ((ARRAY['employee'::character varying, 'manager'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: leave_accrual_run_details id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_accrual_run_details ALTER COLUMN id SET DEFAULT nextval('public.leave_accrual_run_details_id_seq'::regclass);


--
-- Name: leave_accrual_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_accrual_runs ALTER COLUMN id SET DEFAULT nextval('public.leave_accrual_runs_id_seq'::regclass);


--
-- Name: leave_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: leave_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions ALTER COLUMN id SET DEFAULT nextval('public.leave_transactions_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: leave_accrual_run_details leave_accrual_run_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_accrual_run_details
    ADD CONSTRAINT leave_accrual_run_details_pkey PRIMARY KEY (id);


--
-- Name: leave_accrual_runs leave_accrual_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_accrual_runs
    ADD CONSTRAINT leave_accrual_runs_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_settings leave_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settings
    ADD CONSTRAINT leave_settings_pkey PRIMARY KEY (id);


--
-- Name: leave_transactions leave_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions
    ADD CONSTRAINT leave_transactions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: teams teams_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_key UNIQUE (name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: leave_balances unique_user_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT unique_user_year UNIQUE (user_id, year);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_accrual_run_details_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accrual_run_details_run ON public.leave_accrual_run_details USING btree (run_id);


--
-- Name: idx_leave_accrual_runs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_accrual_runs_started_at ON public.leave_accrual_runs USING btree (started_at DESC);


--
-- Name: idx_leave_balances_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_user ON public.leave_balances USING btree (user_id);


--
-- Name: idx_leave_transactions_user_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_transactions_user_year ON public.leave_transactions USING btree (user_id, year);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_notifications_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_date ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: teams_manager_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teams_manager_id_unique ON public.teams USING btree (manager_id) WHERE (manager_id IS NOT NULL);


--
-- Name: unique_leave_balance_user_year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_leave_balance_user_year ON public.leave_balances USING btree (user_id, year);


--
-- Name: unique_leave_transaction_year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_leave_transaction_year ON public.leave_transactions USING btree (leave_request_id, year, transaction_type) WHERE (leave_request_id IS NOT NULL);


--
-- Name: unique_monthly_accrual; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_monthly_accrual ON public.leave_transactions USING btree (user_id, year, period_month) WHERE ((transaction_type)::text = 'accrual'::text);


--
-- Name: leave_accrual_run_details leave_accrual_run_details_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_accrual_run_details
    ADD CONSTRAINT leave_accrual_run_details_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.leave_accrual_runs(id) ON DELETE CASCADE;


--
-- Name: leave_accrual_run_details leave_accrual_run_details_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_accrual_run_details
    ADD CONSTRAINT leave_accrual_run_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_balances leave_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_transactions leave_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions
    ADD CONSTRAINT leave_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: leave_transactions leave_transactions_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions
    ADD CONSTRAINT leave_transactions_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id);


--
-- Name: leave_transactions leave_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions
    ADD CONSTRAINT leave_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 3gsTJc2e577QowkqgyPYv8AlICGGR5FYXrQyPNexlz3tldNZo3HOA2lIjC5OdgM

