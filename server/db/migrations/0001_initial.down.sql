-- 0001_initial.down.sql — откат схемы к пустой базе
drop table if exists config_versions cascade;
drop table if exists queue_jobs cascade;
drop table if exists reports cascade;
drop table if exists calculations cascade;
drop table if exists datasets cascade;
drop table if exists run_calls cascade;
drop table if exists runs cascade;
drop table if exists agent_outputs cascade;
drop table if exists sources cascade;
drop table if exists audio_files cascade;
drop table if exists idea_versions cascade;
drop table if exists ideas cascade;
