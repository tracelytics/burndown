FROM ruby:2.2.4

LABEL description="The dockerfile for running burndown for amigocloud"

RUN apt-get update && \
    apt-get install -y git ruby-full curl vim && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Removed this by switching to the ruby 2.2.4 image
## get the public keys for rvm.
##RUN gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3
##RUN \curl -#L https://git.rvm.io | bash -s stable --autolibs=3 --ruby
##RUN gem install bundle

## From here: https://github.com/docker-library/rails/issues/10#issuecomment-169957222
RUN bundle config --global silence_root_warning 1

RUN git clone https://github.com/appneta/burndown.git /srv/burdown

WORKDIR /srv/burdown

RUN bundle && \
    rake db:migrate
